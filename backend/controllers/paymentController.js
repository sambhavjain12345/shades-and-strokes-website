const pool = require('../config/db');
const { asyncHandler } = require('../middleware/error');
const cashfree = require('../utils/cashfreeService');
const { moneyToCents } = require('../utils/auctionService');
const { sendOrderConfirmation } = require('../utils/emailService');

const fail = (message, statusCode=400) => Object.assign(new Error(message), { statusCode });
const orderNumber = kind => `${kind === 'auction' ? 'SSA' : 'SS'}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const notifyUrl = () => process.env.CASHFREE_WEBHOOK_URL || undefined;
const cleanShipping = body => ({
  shipping_name:String(body.shipping_name || '').trim(),
  shipping_addr:String(body.shipping_addr || '').trim(),
  shipping_phone:String(body.shipping_phone || '').trim(),
  notes:String(body.notes || '').trim() || null,
});

const customerFor = async (userId, fallbackPhone='') => {
  const [[user]] = await pool.query('SELECT id,name,email,phone FROM users WHERE id=? AND is_active=1',[userId]);
  if (!user) throw fail('User account not found',404);
  const phone=String(user.phone || fallbackPhone).replace(/\D/g,'').slice(-10);
  if (phone.length !== 10) throw fail('Add a valid 10-digit phone number to your profile before payment',422);
  return {...user,phone};
};

const verifiedPayment = async attempt => {
  const payments=await cashfree.getOrderPayments(attempt.cashfree_order_id);
  return payments.find(p => p.payment_status === 'SUCCESS'
    && p.payment_currency === 'INR'
    && moneyToCents(p.payment_amount) === moneyToCents(attempt.amount));
};

const createAttempt = async ({ userId, kind, amount, auctionId=null, payload, note }) => {
  const customer=await customerFor(userId,payload.shipping_phone);
  const cashfreeOrderId=`SSP_${kind === 'auction' ? 'A' : 'F'}_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  const cf=await cashfree.createPaymentOrder({
    orderId:cashfreeOrderId,amount,customer,note,
    returnUrl:`${clientUrl()}/checkout?payment_order_id={order_id}${auctionId ? `&auction=${auctionId}` : ''}`,
    notifyUrl:notifyUrl(),
  });
  const [result]=await pool.query(
    `INSERT INTO payment_attempts
      (user_id,auction_id,kind,cashfree_order_id,payment_session_id,amount,status,checkout_payload,expires_at)
     VALUES (?,?,?,?,?,?,'PENDING',?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))`,
    [userId,auctionId,kind,cf.order_id,cf.payment_session_id,amount,JSON.stringify(payload)]
  );
  return { id:result.insertId,cashfree_order_id:cf.order_id,payment_session_id:cf.payment_session_id,amount };
};

exports.startFixedPayment=asyncHandler(async(req,res)=>{
  const shipping=cleanShipping(req.body);
  const requested=new Map();
  for(const item of req.body.items || []) requested.set(Number(item.product_id),(requested.get(Number(item.product_id))||0)+Number(item.quantity));
  if(!requested.size) throw fail('Your cart is empty',422);
  let total=0; const items=[];
  for(const [productId,quantity] of requested){
    const [[p]]=await pool.query("SELECT id,title,price,stock,sale_type FROM products WHERE id=? AND is_active=1",[productId]);
    if(!p) throw fail(`Artwork ${productId} was not found`,404);
    if(p.sale_type!=='fixed') throw fail(`\"${p.title}\" is only available by auction`);
    if(!Number.isInteger(quantity)||quantity<1||Number(p.stock)<quantity) throw fail(`Not enough stock is available for \"${p.title}\"`,409);
    total+=Number(p.price)*quantity; items.push({product_id:p.id,quantity,unit_price:Number(p.price)});
  }
  const attempt=await createAttempt({userId:req.user.id,kind:'fixed',amount:total,payload:{...shipping,items},note:'Shades & Strokes fixed-price artwork order'});
  res.status(201).json({success:true,...attempt});
});

exports.startAuctionPayment=asyncHandler(async(req,res)=>{
  const shipping=cleanShipping(req.body);
  const [[auction]]=await pool.query(
    `SELECT a.*,GREATEST(0,a.active_bid_amount-IFNULL(d.amount,0)) amount_due
     FROM auctions a LEFT JOIN auction_deposits d ON d.auction_id=a.id AND d.user_id=? AND d.status='HELD'
     WHERE a.id=?`,[req.user.id,req.params.id]);
  if(!auction||auction.status!=='payment_pending'||Number(auction.active_buyer_user_id)!==Number(req.user.id)) throw fail('You do not have an active payment offer',403);
  if(auction.payment_due_at&&new Date()>=new Date(auction.payment_due_at)) throw fail('Your payment deadline has expired',409);
  const [[existing]]=await pool.query("SELECT * FROM payment_attempts WHERE auction_id=? AND user_id=? AND (status='CONSUMED' OR (status IN ('PENDING','SUCCESS') AND expires_at>NOW())) ORDER BY id DESC LIMIT 1",[auction.id,req.user.id]);
  if(existing) return res.json({success:true,id:existing.id,cashfree_order_id:existing.cashfree_order_id,payment_session_id:existing.payment_session_id,amount:existing.amount,already_started:true});
  const attempt=await createAttempt({userId:req.user.id,kind:'auction',amount:Number(auction.amount_due),auctionId:auction.id,payload:shipping,note:'Shades & Strokes auction winning-bid balance'});
  res.status(201).json({success:true,...attempt});
});

const finalizeFixed = async (conn,attempt,payload) => {
  let total=0;
  for(const item of payload.items){
    const [[p]]=await conn.query("SELECT id,title,price,stock,sale_type FROM products WHERE id=? AND is_active=1 FOR UPDATE",[item.product_id]);
    if(!p||p.sale_type!=='fixed'||Number(p.stock)<Number(item.quantity)) throw fail(`Artwork is no longer available: ${p?.title || item.product_id}`,409);
    total+=Number(p.price)*Number(item.quantity);
  }
  if(moneyToCents(total)!==moneyToCents(attempt.amount)) throw fail('Order total changed; payment cannot be applied',409);
  const [created]=await conn.query(`INSERT INTO orders
    (order_number,user_id,status,total_amount,order_type,payment_status,amount_charged,shipping_name,shipping_addr,shipping_phone,notes)
    VALUES (?,?,'confirmed',?,'fixed','paid',?,?,?,?,?)`,
    [orderNumber('fixed'),attempt.user_id,total,total,payload.shipping_name,payload.shipping_addr,payload.shipping_phone,payload.notes]);
  for(const item of payload.items){
    const [[p]]=await conn.query('SELECT price FROM products WHERE id=?',[item.product_id]);
    await conn.query('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,?,?)',[created.insertId,item.product_id,item.quantity,p.price]);
    await conn.query('UPDATE products SET stock=stock-? WHERE id=?',[item.quantity,item.product_id]);
    await conn.query('DELETE FROM cart_items WHERE user_id=? AND product_id=?',[attempt.user_id,item.product_id]);
  }
  await conn.query("INSERT INTO order_timeline (order_id,status,description) VALUES (?,'confirmed','Payment verified by Cashfree; order confirmed')",[created.insertId]);
  return created.insertId;
};

const finalizeAuction = async (conn,attempt,payload) => {
  const [[a]]=await conn.query(`SELECT a.*,p.id product_id,d.id deposit_id,d.amount deposit_amount,d.status deposit_status
    FROM auctions a JOIN products p ON p.id=a.product_id LEFT JOIN auction_deposits d ON d.auction_id=a.id AND d.user_id=?
    WHERE a.id=? FOR UPDATE`,[attempt.user_id,attempt.auction_id]);
  if(!a||a.status!=='payment_pending'||Number(a.active_buyer_user_id)!==Number(attempt.user_id)) throw fail('Auction offer is no longer payable',409);
  const applied=a.deposit_status==='HELD'?Math.min(Number(a.deposit_amount),Number(a.active_bid_amount)):0;
  if(moneyToCents(Number(a.active_bid_amount)-applied)!==moneyToCents(attempt.amount)) throw fail('Auction payable amount does not match',409);
  const [created]=await conn.query(`INSERT INTO orders
    (order_number,user_id,status,total_amount,order_type,payment_status,auction_id,deposit_applied,amount_charged,shipping_name,shipping_addr,shipping_phone,notes)
    VALUES (?,?,'confirmed',?,'auction','paid',?,?,?,?,?,?,?)`,
    [orderNumber('auction'),attempt.user_id,a.active_bid_amount,a.id,applied,attempt.amount,payload.shipping_name,payload.shipping_addr,payload.shipping_phone,payload.notes]);
  await conn.query('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,1,?)',[created.insertId,a.product_id,a.active_bid_amount]);
  await conn.query("INSERT INTO order_timeline (order_id,status,description) VALUES (?,'confirmed','Auction balance verified by Cashfree; deposit applied')",[created.insertId]);
  if(a.deposit_id) await conn.query("UPDATE auction_deposits SET status='APPLIED' WHERE id=? AND status='HELD'",[a.deposit_id]);
  await conn.query("UPDATE auction_settlement_candidates SET status='COMPLETED' WHERE auction_id=? AND user_id=?",[a.id,attempt.user_id]);
  await conn.query("UPDATE auctions SET status='sold',settlement_status='COMPLETED',settled_user_id=?,payment_due_at=NULL WHERE id=?",[attempt.user_id,a.id]);
  await conn.query('UPDATE products SET stock=0 WHERE id=?',[a.product_id]);
  return created.insertId;
};

exports.verifyPayment=asyncHandler(async(req,res)=>{
  const [[lookup]]=await pool.query('SELECT * FROM payment_attempts WHERE cashfree_order_id=? AND user_id=?',[req.body.cashfree_order_id,req.user.id]);
  if(!lookup) throw fail('Payment attempt not found',404);
  if(lookup.order_id){const [[order]]=await pool.query('SELECT * FROM orders WHERE id=?',[lookup.order_id]);return res.json({success:true,already_completed:true,order});}
  const payment=await verifiedPayment(lookup);
  if(!payment){await pool.query("UPDATE payment_attempts SET status='FAILED' WHERE id=? AND expires_at<NOW()",[lookup.id]);throw fail('Cashfree has not confirmed a successful payment yet',409);}
  const conn=await pool.getConnection(); let orderId;
  try{
    await conn.beginTransaction();
    const [[attempt]]=await conn.query('SELECT * FROM payment_attempts WHERE id=? FOR UPDATE',[lookup.id]);
    if(attempt.order_id){orderId=attempt.order_id;} else {
      const payload=typeof attempt.checkout_payload==='string'?JSON.parse(attempt.checkout_payload):attempt.checkout_payload;
      orderId=attempt.kind==='auction'?await finalizeAuction(conn,attempt,payload):await finalizeFixed(conn,attempt,payload);
      await conn.query("UPDATE payment_attempts SET status='CONSUMED',cashfree_payment_id=?,order_id=? WHERE id=? AND order_id IS NULL",[String(payment.cf_payment_id),orderId,attempt.id]);
    }
    await conn.commit();
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  const [[order]]=await pool.query('SELECT * FROM orders WHERE id=?',[orderId]);
  const [items]=await pool.query(`SELECT oi.*,p.title,p.image_url,a.name artist_name FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN artists a ON a.id=p.artist_id WHERE oi.order_id=?`,[orderId]);
  const [[user]]=await pool.query('SELECT id,name,email FROM users WHERE id=?',[req.user.id]);
  sendOrderConfirmation(order,items,user).catch(error=>console.error('Order email failed:',error.message));
  res.status(201).json({success:true,order});
});

