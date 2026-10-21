const pool=require('../config/db');
const {asyncHandler}=require('../middleware/error');
const {advanceSettlementLocked,finalizeExpiredAuctions,finalizeLockedAuction,minimumNextBid,moneyToCents,
  refreshAuctionById,refundNonFinalists}=require('../utils/auctionService');
const cashfree=require('../utils/cashfreeService');
const crypto=require('crypto');

const maskBidderName=(name='Bidder')=>{
  const parts=name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0]?.toUpperCase()||'B'}•••${parts.length>1?` ${parts.at(-1)[0].toUpperCase()}.`:''}`;
};

exports.runSettlement=asyncHandler(async(req,res)=>{
  const expected=String(process.env.CRON_SECRET||'');
  const supplied=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const valid=expected&&supplied&&Buffer.byteLength(expected)===Buffer.byteLength(supplied)
    && crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(supplied));
  if(!valid)return res.status(401).json({success:false,message:'Invalid cron credentials'});
  await finalizeExpiredAuctions();
  res.json({success:true,message:'Auction settlement sweep completed',timestamp:new Date().toISOString()});
});

exports.getAuctions=asyncHandler(async(req,res)=>{
  await finalizeExpiredAuctions();
  await pool.query("UPDATE auctions SET status='active' WHERE status='scheduled' AND starts_at<=NOW() AND ends_at>NOW()");
  const [auctions]=await pool.query(
    `SELECT a.id AS auction_id,a.starting_price,a.current_bid,a.minimum_increment,a.deposit_amount,a.starts_at,a.ends_at,a.status,
       p.id,p.title,p.slug,p.price,p.stock,p.tag,p.image_url,p.medium,p.dimensions,p.year,p.sale_type,
       ar.id AS artist_id,ar.name AS artist_name,c.id AS category_id,c.name AS category_name,c.slug AS category_slug,
       (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) AS bid_count
     FROM auctions a JOIN products p ON a.product_id=p.id JOIN artists ar ON p.artist_id=ar.id JOIN categories c ON p.category_id=c.id
     WHERE p.is_active=1 AND p.sale_type='auction' AND a.status IN ('scheduled','active') AND a.ends_at>NOW()
     ORDER BY CASE a.status WHEN 'active' THEN 0 ELSE 1 END,a.ends_at ASC`);
  res.json({success:true,auctions});
});

exports.getProductAuction=asyncHandler(async(req,res)=>{
  const [[lookup]]=await pool.query('SELECT id FROM auctions WHERE product_id=?',[req.params.productId]);
  if(!lookup)return res.status(404).json({success:false,message:'Auction not found'});
  await refreshAuctionById(lookup.id);
  const [[auction]]=await pool.query(
    `SELECT a.*,winner.name AS winner_name,activeBuyer.name AS active_buyer_name,
       (SELECT COUNT(*) FROM bids b WHERE b.auction_id=a.id) AS bid_count
     FROM auctions a LEFT JOIN users winner ON a.winner_user_id=winner.id
     LEFT JOIN users activeBuyer ON a.active_buyer_user_id=activeBuyer.id WHERE a.product_id=?`,[req.params.productId]);
  const [bidRows]=await pool.query(
    `SELECT b.id,b.amount,b.created_at,b.user_id,u.name FROM bids b JOIN users u ON b.user_id=u.id
     WHERE b.auction_id=? ORDER BY b.amount DESC,b.created_at ASC LIMIT 50`,[auction.id]);
  const currentUserId=req.user?.id;
  let myDeposit=null;
  let myCandidate=null;
  if(currentUserId){
    [[myDeposit]]=await pool.query('SELECT amount,status,held_at,updated_at FROM auction_deposits WHERE auction_id=? AND user_id=?',[auction.id,currentUserId]);
    [[myCandidate]]=await pool.query('SELECT bidder_rank,final_bid,status,payment_due_at FROM auction_settlement_candidates WHERE auction_id=? AND user_id=?',[auction.id,currentUserId]);
  }
  res.json({success:true,auction:{
    id:auction.id,product_id:auction.product_id,starting_price:auction.starting_price,current_bid:auction.current_bid,
    minimum_increment:auction.minimum_increment,minimum_next_bid:minimumNextBid(auction),deposit_amount:auction.deposit_amount,
    starts_at:auction.starts_at,ends_at:auction.ends_at,status:auction.status,settlement_status:auction.settlement_status,
    reserve_met:['payment_pending','sold'].includes(auction.status),winning_bid:auction.winning_bid,ended_at:auction.ended_at,
    payment_due_at:auction.payment_due_at,active_bid_amount:auction.active_bid_amount,active_bidder_rank:auction.active_bidder_rank,
    active_offer:{is_me:Boolean(currentUserId&&auction.active_buyer_user_id===currentUserId),bidder:auction.active_buyer_user_id?maskBidderName(auction.active_buyer_name):null},
    bid_count:auction.bid_count,winner:auction.winner_user_id?{bidder:maskBidderName(auction.winner_name),is_me:Boolean(currentUserId&&auction.winner_user_id===currentUserId)}:null,
    my_deposit:myDeposit||null,my_candidate:myCandidate||null,
    bids:bidRows.map(bid=>({id:bid.id,amount:bid.amount,created_at:bid.created_at,bidder:maskBidderName(bid.name),is_mine:Boolean(currentUserId&&bid.user_id===currentUserId)})),
  }});
});

exports.holdDeposit=asyncHandler(async(req,res)=>{
  if(req.user.role==='admin')return res.status(403).json({success:false,message:'Administrator accounts cannot bid'});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[auction]]=await conn.query(
      `SELECT a.*,ar.user_id AS artist_user_id,NOW() AS db_now,u.name AS customer_name,u.email AS customer_email,u.phone AS customer_phone
       FROM auctions a JOIN products p ON p.id=a.product_id JOIN artists ar ON ar.id=p.artist_id JOIN users u ON u.id=?
       WHERE a.id=? AND p.is_active=1 AND p.sale_type='auction' FOR UPDATE`,[req.user.id,req.params.id]);
    if(!auction){await conn.rollback();return res.status(404).json({success:false,message:'Auction not found'});}
    if(auction.artist_user_id===req.user.id){await conn.rollback();return res.status(403).json({success:false,message:'Artists cannot bid on their own artwork'});}
    if(!['scheduled','active'].includes(auction.status)||new Date(auction.db_now)>=new Date(auction.ends_at)){
      await conn.rollback();return res.status(409).json({success:false,message:'Deposits are closed for this auction'});
    }
    if(!auction.customer_phone||String(auction.customer_phone).replace(/\D/g,'').length<10){await conn.rollback();return res.status(422).json({success:false,message:'Add a valid phone number to your profile before paying the deposit'});}
    let [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE auction_id=? AND user_id=? FOR UPDATE',[auction.id,req.user.id]);
    if(deposit?.status==='HELD'){await conn.commit();return res.json({success:true,already_held:true,deposit});}
    if(deposit?.payment_session_id&&deposit.payment_status==='PENDING'){
      await conn.commit();return res.json({success:true,payment_session_id:deposit.payment_session_id,cashfree_order_id:deposit.cashfree_order_id,deposit});
    }
    if(!deposit){
      const [result]=await conn.query("INSERT INTO auction_deposits (auction_id,user_id,amount,status,payment_status) VALUES (?,?,?,'PAYMENT_PENDING','CREATED')",[auction.id,req.user.id,auction.deposit_amount]);
      [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE id=? FOR UPDATE',[result.insertId]);
    }else{
      await conn.query("UPDATE auction_deposits SET status='PAYMENT_PENDING',payment_status='CREATED',payment_attempt=payment_attempt+1 WHERE id=?",[deposit.id]);
      deposit.payment_attempt=Number(deposit.payment_attempt||1)+1;
    }
    const orderId=`SSAD_${deposit.id}_${deposit.payment_attempt}_${Date.now().toString(36)}`;
    const clientUrl=(process.env.CLIENT_URL||'http://localhost:3000').replace(/\/$/,'');
    const cfOrder=await cashfree.createDepositOrder({
      orderId,amount:auction.deposit_amount,
      customer:{id:req.user.id,name:auction.customer_name,email:auction.customer_email,phone:auction.customer_phone},
      returnUrl:`${clientUrl}/product/${auction.product_id}?cashfree_order_id={order_id}`,
      notifyUrl:process.env.CASHFREE_WEBHOOK_URL,
    });
    await conn.query("UPDATE auction_deposits SET cashfree_order_id=?,payment_session_id=?,payment_status='PENDING' WHERE id=?",
      [cfOrder.order_id,cfOrder.payment_session_id,deposit.id]);
    await conn.commit();return res.status(201).json({success:true,payment_session_id:cfOrder.payment_session_id,cashfree_order_id:cfOrder.order_id,deposit_amount:auction.deposit_amount});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

const verifyDepositLocked=async(conn,deposit)=>{
  if(deposit.status==='HELD'&&deposit.payment_status==='SUCCESS')return deposit;
  if(!deposit.cashfree_order_id)throw Object.assign(new Error('Cashfree order is missing'),{statusCode:409});
  const payments=await cashfree.getOrderPayments(deposit.cashfree_order_id);
  const successful=payments.find(payment=>payment.payment_status==='SUCCESS'
    && moneyToCents(payment.payment_amount)===moneyToCents(deposit.amount)
    && payment.payment_currency==='INR');
  if(!successful){
    const pending=payments.some(payment=>payment.payment_status==='PENDING');
    await conn.query('UPDATE auction_deposits SET payment_status=? WHERE id=?',[pending?'PENDING':'FAILED',deposit.id]);
    return null;
  }
  await conn.query("UPDATE auction_deposits SET status='HELD',payment_status='SUCCESS',cashfree_payment_id=? WHERE id=? AND status='PAYMENT_PENDING'",
    [String(successful.cf_payment_id),deposit.id]);
  return {...deposit,status:'HELD',payment_status:'SUCCESS',cashfree_payment_id:String(successful.cf_payment_id)};
};

exports.verifyDeposit=asyncHandler(async(req,res)=>{
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE auction_id=? AND user_id=? FOR UPDATE',[req.params.id,req.user.id]);
    if(!deposit){await conn.rollback();return res.status(404).json({success:false,message:'Deposit payment was not started'});}
    const verified=await verifyDepositLocked(conn,deposit);
    await conn.commit();
    if(!verified)return res.status(409).json({success:false,message:'Cashfree has not confirmed a successful deposit payment yet'});
    return res.json({success:true,deposit:{amount:verified.amount,status:'HELD',payment_status:'SUCCESS'}});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

exports.cashfreeWebhook=asyncHandler(async(req,res)=>{
  const valid=cashfree.verifyWebhookSignature({signature:req.headers['x-webhook-signature'],timestamp:req.headers['x-webhook-timestamp'],rawBody:req.rawBody});
  if(!valid)return res.status(401).json({success:false,message:'Invalid Cashfree webhook signature'});
  const orderId=req.body?.data?.order?.order_id;
  if(!orderId)return res.json({success:true});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE cashfree_order_id=? FOR UPDATE',[orderId]);
    if(deposit)await verifyDepositLocked(conn,deposit);
    await conn.commit();return res.json({success:true});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

exports.getWonAuctions=asyncHandler(async(req,res)=>{
  await finalizeExpiredAuctions();
  const [auctions]=await pool.query(
    `SELECT a.id,a.product_id,a.status,a.settlement_status,a.winning_bid,a.active_bid_amount,a.active_bidder_rank,a.payment_due_at,a.ended_at,
       (a.active_buyer_user_id=?) AS is_active_buyer,p.title,p.image_url,p.medium,ar.name AS artist_name,
       d.amount AS deposit_amount,d.status AS deposit_status,c.bidder_rank,c.final_bid,c.status AS candidate_status,
       GREATEST(0,a.active_bid_amount-IFNULL(d.amount,0)) AS amount_due,o.id AS order_id,o.order_number,o.payment_status
     FROM auctions a JOIN products p ON p.id=a.product_id JOIN artists ar ON ar.id=p.artist_id
     LEFT JOIN auction_deposits d ON d.auction_id=a.id AND d.user_id=?
     LEFT JOIN auction_settlement_candidates c ON c.auction_id=a.id AND c.user_id=?
     LEFT JOIN orders o ON o.auction_id=a.id
     WHERE c.user_id=? OR a.settled_user_id=? ORDER BY a.ended_at DESC`,
    [req.user.id,req.user.id,req.user.id,req.user.id,req.user.id]);
  res.json({success:true,auctions});
});

exports.checkoutWonAuction=asyncHandler(async(req,res)=>{
  const {shipping_name,shipping_addr,shipping_phone,notes}=req.body;
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[auction]]=await conn.query(`SELECT a.*,p.title,NOW() AS db_now FROM auctions a JOIN products p ON p.id=a.product_id WHERE a.id=? FOR UPDATE`,[req.params.id]);
    if(!auction){await conn.rollback();return res.status(404).json({success:false,message:'Auction not found'});}
    const [[existingOrder]]=await conn.query('SELECT * FROM orders WHERE auction_id=? FOR UPDATE',[auction.id]);
    if(existingOrder){
      if(existingOrder.user_id!==req.user.id){await conn.rollback();return res.status(409).json({success:false,message:'This auction is already settled'});}
      await conn.commit();return res.json({success:true,already_completed:true,order:existingOrder});
    }
    if(auction.status==='payment_pending'&&auction.payment_due_at&&new Date(auction.db_now)>=new Date(auction.payment_due_at)){
      await advanceSettlementLocked(conn,auction,'checkout_after_deadline');await conn.commit();
      return res.status(409).json({success:false,message:'Your payment deadline has expired'});
    }
    if(auction.status!=='payment_pending'||auction.active_buyer_user_id!==req.user.id||auction.active_bid_amount==null){
      await conn.rollback();return res.status(403).json({success:false,message:'You do not have the active purchase offer'});
    }
    const [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE auction_id=? AND user_id=? FOR UPDATE',[auction.id,req.user.id]);
    const depositApplied=deposit?.status==='HELD'?Math.min(Number(deposit.amount),Number(auction.active_bid_amount)):0;
    const amountCharged=Math.max(0,Number(auction.active_bid_amount)-depositApplied);
    const orderNumber=`SSA-${Date.now()}-${Math.floor(1000+Math.random()*9000)}`;
    const [orderResult]=await conn.query(
      `INSERT INTO orders (order_number,user_id,status,total_amount,order_type,payment_status,auction_id,deposit_applied,amount_charged,
       shipping_name,shipping_addr,shipping_phone,notes) VALUES (?,?,'confirmed',?,'auction','paid',?,?,?,?,?,?,?)`,
      [orderNumber,req.user.id,auction.active_bid_amount,auction.id,depositApplied,amountCharged,shipping_name,shipping_addr,shipping_phone,notes||null]);
    await conn.query('INSERT INTO order_items (order_id,product_id,quantity,unit_price) VALUES (?,?,1,?)',[orderResult.insertId,auction.product_id,auction.active_bid_amount]);
    await conn.query("INSERT INTO order_timeline (order_id,status,description) VALUES (?,'confirmed','Auction balance paid; security deposit applied')",[orderResult.insertId]);
    if(depositApplied>0)await conn.query("UPDATE auction_deposits SET status='APPLIED' WHERE id=? AND status='HELD'",[deposit.id]);
    await refundNonFinalists(conn,auction.id,[req.user.id]);
    await conn.query("UPDATE auction_settlement_candidates SET status='COMPLETED' WHERE auction_id=? AND user_id=?",[auction.id,req.user.id]);
    await conn.query("UPDATE auctions SET status='sold',settlement_status='COMPLETED',settled_user_id=?,payment_due_at=NULL WHERE id=?",[req.user.id,auction.id]);
    await conn.query('UPDATE products SET stock=0 WHERE id=?',[auction.product_id]);
    const [[order]]=await conn.query('SELECT * FROM orders WHERE id=?',[orderResult.insertId]);
    await conn.commit();return res.status(201).json({success:true,order});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

exports.declineOffer=asyncHandler(async(req,res)=>{
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[auction]]=await conn.query('SELECT *,NOW() AS db_now FROM auctions WHERE id=? FOR UPDATE',[req.params.id]);
    if(!auction){await conn.rollback();return res.status(404).json({success:false,message:'Auction not found'});}
    if(auction.status!=='payment_pending'||auction.active_buyer_user_id!==req.user.id){await conn.rollback();return res.status(403).json({success:false,message:'You do not have the active purchase offer'});}
    await advanceSettlementLocked(conn,auction,'declined');
    await conn.commit();return res.json({success:true,message:Number(auction.active_bidder_rank)===1?'Offer declined; your deposit was forfeited':'Offer declined; your deposit was refunded'});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

exports.placeBid=asyncHandler(async(req,res)=>{
  if(req.user.role==='admin')return res.status(403).json({success:false,message:'Administrator accounts cannot place bids'});
  const amountText=String(req.body.amount).trim();
  const amountCents=moneyToCents(amountText);
  if(!/^\d+(?:\.\d{1,2})?$/.test(amountText)||amountCents==null)return res.status(422).json({success:false,message:'Bid must be a positive amount with at most two decimal places'});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [[auction]]=await conn.query(
      `SELECT a.*,p.artist_id,ar.user_id AS artist_user_id,NOW() AS db_now,(SELECT COUNT(*) FROM bids x WHERE x.auction_id=a.id) AS bid_count
       FROM auctions a JOIN products p ON a.product_id=p.id JOIN artists ar ON p.artist_id=ar.id
       WHERE a.id=? AND p.is_active=1 AND p.sale_type='auction' FOR UPDATE`,[req.params.id]);
    if(!auction){await conn.rollback();return res.status(404).json({success:false,message:'Auction not found'});}
    if(auction.artist_user_id===req.user.id){await conn.rollback();return res.status(403).json({success:false,message:'Artists cannot bid on their own artwork'});}
    const now=new Date(auction.db_now);
    if(auction.status==='scheduled'&&now>=new Date(auction.starts_at)&&now<new Date(auction.ends_at)){await conn.query("UPDATE auctions SET status='active' WHERE id=?",[auction.id]);auction.status='active';}
    if(['scheduled','active'].includes(auction.status)&&now>=new Date(auction.ends_at)){await finalizeLockedAuction(conn,auction);await conn.commit();return res.status(409).json({success:false,message:'This auction has ended'});}
    if(auction.status==='scheduled'||now<new Date(auction.starts_at)){await conn.rollback();return res.status(400).json({success:false,message:'This auction has not started yet'});}
    if(auction.status!=='active'){await conn.rollback();return res.status(409).json({success:false,message:'This auction is no longer accepting bids'});}
    const [[deposit]]=await conn.query("SELECT id,status,payment_status FROM auction_deposits WHERE auction_id=? AND user_id=? FOR UPDATE",[auction.id,req.user.id]);
    if(!deposit||deposit.status!=='HELD'||deposit.payment_status!=='SUCCESS'){await conn.rollback();return res.status(402).json({success:false,message:'A verified Cashfree security deposit is required before bidding',deposit_required:true,deposit_amount:auction.deposit_amount});}
    const nextBidCents=Math.round(minimumNextBid(auction)*100);
    if(amountCents<nextBidCents){await conn.rollback();return res.status(422).json({success:false,message:`Minimum next bid is ₹ ${(nextBidCents/100).toLocaleString('en-IN')}`,minimum_next_bid:nextBidCents/100});}
    const amount=amountCents/100;
    const [result]=await conn.query('INSERT INTO bids (auction_id,user_id,amount) VALUES (?,?,?)',[auction.id,req.user.id,amount]);
    await conn.query('UPDATE auctions SET current_bid=?,current_bidder_id=? WHERE id=?',[amount,req.user.id,auction.id]);
    await conn.commit();return res.status(201).json({success:true,bid:{id:result.insertId,amount,bidder:'You',is_mine:true,created_at:new Date().toISOString()},auction:{current_bid:amount,minimum_next_bid:amount+Number(auction.minimum_increment),bid_count:Number(auction.bid_count||0)+1}});
  }catch(error){await conn.rollback();throw error;}finally{conn.release();}
});

module.exports.maskBidderName=maskBidderName;
