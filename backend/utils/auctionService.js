const pool = require('../config/db');
const cashfree = require('./cashfreeService');

const httpError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const moneyToCents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
};

const minimumNextBid = auction => {
  const base = auction.current_bid == null ? auction.starting_price : auction.current_bid;
  const increment = auction.current_bid == null ? 0 : auction.minimum_increment;
  return (moneyToCents(base) + (moneyToCents(increment) || 0)) / 100;
};

const validateAuctionConfig = (input, now = new Date()) => {
  const startingPrice = moneyToCents(input.auction_starting_price ?? input.price);
  const increment = moneyToCents(input.minimum_increment);
  const reservePrice = moneyToCents(input.reserve_price ?? input.auction_starting_price ?? input.price);
  const depositAmount = moneyToCents(input.deposit_amount ?? 500);
  const paymentWindowHours = Number(input.payment_window_hours ?? 48);
  const secondChanceWindowHours = Number(input.second_chance_window_hours ?? 24);
  const startsAt = new Date(input.starts_at);
  const endsAt = new Date(input.ends_at);

  if (startingPrice == null) throw httpError('Starting price must be greater than 0');
  if (increment == null) throw httpError('Minimum bid increment must be greater than 0');
  if (reservePrice == null || reservePrice < startingPrice) throw httpError('Reserve price must be at least the starting price');
  if (depositAmount == null) throw httpError('Security deposit must be greater than 0');
  if (!Number.isInteger(paymentWindowHours) || paymentWindowHours < 1 || paymentWindowHours > 168) throw httpError('Payment window must be between 1 and 168 hours');
  if (!Number.isInteger(secondChanceWindowHours) || secondChanceWindowHours < 1 || secondChanceWindowHours > 168) throw httpError('Second-chance window must be between 1 and 168 hours');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw httpError('Valid auction start and end times are required');
  if (endsAt <= startsAt) throw httpError('Auction end time must be after its start time');
  if (endsAt <= now) throw httpError('Auction end time must be in the future');
  return { startingPrice:startingPrice/100,minimumIncrement:increment/100,reservePrice:reservePrice/100,
    depositAmount:depositAmount/100,paymentWindowHours,secondChanceWindowHours,startsAt,endsAt,
    status:startsAt>now?'scheduled':'active' };
};

const configureAuction = async (executor, productId, saleType, input) => {
  if (saleType === 'fixed') {
    const [[auction]] = await executor.query(
      `SELECT a.id,a.current_bid,(SELECT COUNT(*) FROM auction_deposits d WHERE d.auction_id=a.id) AS deposit_count
       FROM auctions a WHERE a.product_id=? FOR UPDATE`, [productId]
    );
    if (auction?.current_bid != null || Number(auction?.deposit_count || 0)>0) throw httpError('An auction with bids or deposits cannot be converted to fixed price',409);
    if (auction) await executor.query("UPDATE auctions SET status='cancelled' WHERE id=?",[auction.id]);
    await executor.query("UPDATE products SET sale_type='fixed' WHERE id=?",[productId]);
    return null;
  }
  if (saleType !== 'auction') throw httpError('Sale type must be fixed or auction');
  const config=validateAuctionConfig(input);
  const [[existing]]=await executor.query(
    `SELECT a.*,(SELECT COUNT(*) FROM auction_deposits d WHERE d.auction_id=a.id) AS deposit_count
     FROM auctions a WHERE a.product_id=? FOR UPDATE`,[productId]
  );
  if (existing && (existing.current_bid!=null || Number(existing.deposit_count)>0)) {
    const unchanged=moneyToCents(existing.starting_price)===moneyToCents(config.startingPrice)
      && moneyToCents(existing.reserve_price)===moneyToCents(config.reservePrice)
      && moneyToCents(existing.deposit_amount)===moneyToCents(config.depositAmount)
      && moneyToCents(existing.minimum_increment)===moneyToCents(config.minimumIncrement)
      && Number(existing.payment_window_hours)===config.paymentWindowHours
      && Number(existing.second_chance_window_hours)===config.secondChanceWindowHours
      && new Date(existing.starts_at).getTime()===config.startsAt.getTime()
      && new Date(existing.ends_at).getTime()===config.endsAt.getTime();
    if (!unchanged) throw httpError('Auction terms cannot be changed after a deposit or bid',409);
  }
  await executor.query(
    `INSERT INTO auctions (product_id,starting_price,reserve_price,deposit_amount,payment_window_hours,second_chance_window_hours,minimum_increment,starts_at,ends_at,status)
     VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE starting_price=VALUES(starting_price),reserve_price=VALUES(reserve_price),
       deposit_amount=VALUES(deposit_amount),payment_window_hours=VALUES(payment_window_hours),second_chance_window_hours=VALUES(second_chance_window_hours),
       minimum_increment=VALUES(minimum_increment),starts_at=VALUES(starts_at),ends_at=VALUES(ends_at),status=IF(current_bid IS NULL,VALUES(status),status)`,
    [productId,config.startingPrice,config.reservePrice,config.depositAmount,config.paymentWindowHours,config.secondChanceWindowHours,
      config.minimumIncrement,config.startsAt,config.endsAt,config.status]
  );
  await executor.query("UPDATE products SET sale_type='auction',price=? WHERE id=?",[config.startingPrice,productId]);
  return config;
};

const refundDeposit = async (conn, auctionId, userId) => {
  const [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE auction_id=? AND user_id=? FOR UPDATE',[auctionId,userId]);
  if(!deposit||!['HELD','REFUND_PENDING'].includes(deposit.status))return false;
  const refundId=deposit.refund_id||`SSADR_${deposit.id}`;
  await conn.query("UPDATE auction_deposits SET status='REFUND_PENDING',refund_id=?,refund_status=COALESCE(refund_status,'PENDING') WHERE id=? AND status IN ('HELD','REFUND_PENDING')",[refundId,deposit.id]);
  if(!deposit.cashfree_order_id){
    await conn.query("UPDATE auction_deposits SET status='REFUNDED',refund_status='SUCCESS' WHERE id=? AND status='REFUND_PENDING'",[deposit.id]);
    return true;
  }
  try{
    const refund=await cashfree.createRefund({orderId:deposit.cashfree_order_id,refundId,amount:deposit.amount});
    const succeeded=refund.refund_status==='SUCCESS';
    await conn.query(
      `UPDATE auction_deposits SET status=?,cashfree_refund_id=?,refund_status=? WHERE id=? AND status='REFUND_PENDING'`,
      [succeeded?'REFUNDED':'REFUND_PENDING',refund.cf_refund_id||null,refund.refund_status||'PENDING',deposit.id]
    );
    return succeeded;
  }catch(error){
    await conn.query("UPDATE auction_deposits SET refund_status='INITIATION_FAILED' WHERE id=? AND status='REFUND_PENDING'",[deposit.id]);
    return false;
  }
};

const refundNonFinalists = async (conn, auctionId, finalistIds=[]) => {
  const params=[auctionId,...finalistIds];
  const exclusion=finalistIds.length?` AND user_id NOT IN (${finalistIds.map(()=>'?').join(',')})`:'';
  const [deposits]=await conn.query(`SELECT user_id FROM auction_deposits WHERE auction_id=? AND status IN ('HELD','REFUND_PENDING')${exclusion} FOR UPDATE`,params);
  for(const deposit of deposits)await refundDeposit(conn,auctionId,deposit.user_id);
};

const markUnsold = async (conn, auction) => {
  await refundNonFinalists(conn,auction.id);
  await conn.query(
    `UPDATE auctions SET status='unsold',settlement_status='UNSOLD',active_buyer_user_id=NULL,active_bid_amount=NULL,
       active_bidder_rank=NULL,payment_due_at=NULL,winner_user_id=NULL,winning_bid=NULL,ended_at=COALESCE(ended_at,NOW()) WHERE id=?`,[auction.id]
  );
  await conn.query('UPDATE products SET stock=1 WHERE id=?',[auction.product_id]);
};

const finalizeLockedAuction = async (conn, auction) => {
  const [candidates]=await conn.query(
    `SELECT b.user_id,MAX(b.amount) AS final_bid,MIN(b.id) AS first_bid_id
     FROM bids b JOIN auction_deposits d ON d.auction_id=b.auction_id AND d.user_id=b.user_id AND d.status='HELD' AND d.payment_status='SUCCESS'
     WHERE b.auction_id=? GROUP BY b.user_id ORDER BY final_bid DESC,first_bid_id ASC LIMIT 3`,[auction.id]
  );
  const highest=candidates[0];
  if (!highest || moneyToCents(highest.final_bid)<moneyToCents(auction.reserve_price)) {
    await markUnsold(conn,auction);
    return null;
  }
  for (let index=0;index<candidates.length;index+=1) {
    const candidate=candidates[index];
    await conn.query(
      `INSERT INTO auction_settlement_candidates (auction_id,user_id,bidder_rank,final_bid,status) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE final_bid=VALUES(final_bid),status=VALUES(status)`,
      [auction.id,candidate.user_id,index+1,candidate.final_bid,index===0?'AWAITING_PAYMENT':'WAITING']
    );
  }
  await refundNonFinalists(conn,auction.id,candidates.map(candidate=>candidate.user_id));
  const hours=Math.min(168,Math.max(1,Number(auction.payment_window_hours)||48));
  await conn.query(`UPDATE auction_settlement_candidates SET offered_at=NOW(),payment_due_at=DATE_ADD(NOW(),INTERVAL ${hours} HOUR) WHERE auction_id=? AND bidder_rank=1`,[auction.id]);
  await conn.query(
    `UPDATE auctions SET status='payment_pending',settlement_status='AWAITING_PAYMENT',winner_user_id=?,winning_bid=?,
       active_buyer_user_id=?,active_bid_amount=?,active_bidder_rank=1,payment_due_at=DATE_ADD(NOW(),INTERVAL ${hours} HOUR),ended_at=NOW() WHERE id=?`,
    [highest.user_id,highest.final_bid,highest.user_id,highest.final_bid,auction.id]
  );
  await conn.query('UPDATE products SET stock=0 WHERE id=?',[auction.product_id]);
  return highest;
};

const advanceSettlementLocked = async (conn, auction, reason='timeout') => {
  const rank=Number(auction.active_bidder_rank||1);
  const userId=auction.active_buyer_user_id;
  if (userId) {
    const originalWinner=rank===1;
    await conn.query(
      `UPDATE auction_settlement_candidates SET status=? WHERE auction_id=? AND user_id=? AND status IN ('AWAITING_PAYMENT','SECOND_CHANCE')`,
      [originalWinner?'DEFAULTED':'DECLINED',auction.id,userId]
    );
    if (originalWinner) await conn.query("UPDATE auction_deposits SET status='FORFEITED' WHERE auction_id=? AND user_id=? AND status='HELD'",[auction.id,userId]);
    else await refundDeposit(conn,auction.id,userId);
  }
  const [[next]]=await conn.query(
    `SELECT c.* FROM auction_settlement_candidates c JOIN auction_deposits d ON d.auction_id=c.auction_id AND d.user_id=c.user_id AND d.status='HELD' AND d.payment_status='SUCCESS'
     WHERE c.auction_id=? AND c.bidder_rank>? AND c.status='WAITING' ORDER BY c.bidder_rank ASC LIMIT 1`,[auction.id,rank]
  );
  if (!next) { await markUnsold(conn,auction); return null; }
  const hours=Math.min(168,Math.max(1,Number(auction.second_chance_window_hours)||24));
  await conn.query(`UPDATE auction_settlement_candidates SET status='SECOND_CHANCE',offered_at=NOW(),payment_due_at=DATE_ADD(NOW(),INTERVAL ${hours} HOUR) WHERE id=?`,[next.id]);
  await conn.query(
    `UPDATE auctions SET settlement_status='SECOND_CHANCE',active_buyer_user_id=?,active_bid_amount=?,active_bidder_rank=?,payment_due_at=DATE_ADD(NOW(),INTERVAL ${hours} HOUR) WHERE id=?`,
    [next.user_id,next.final_bid,next.bidder_rank,auction.id]
  );
  return {...next,reason};
};

const refreshAuctionById = async auctionId => {
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[auction]]=await conn.query('SELECT *,NOW() AS db_now FROM auctions WHERE id=? FOR UPDATE',[auctionId]);
    if (!auction) { await conn.rollback(); return null; }
    const now=new Date(auction.db_now);
    if (auction.status==='scheduled' && now>=new Date(auction.starts_at) && now<new Date(auction.ends_at)) {
      await conn.query("UPDATE auctions SET status='active' WHERE id=?",[auction.id]); auction.status='active';
    }
    if (['scheduled','active'].includes(auction.status) && now>=new Date(auction.ends_at)) {
      const winner=await finalizeLockedAuction(conn,auction); auction.status=winner?'payment_pending':'unsold';
    } else if (auction.status==='payment_pending' && auction.payment_due_at && now>=new Date(auction.payment_due_at)) {
      await advanceSettlementLocked(conn,auction,'timeout');
    }
    await conn.commit(); return auction;
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
};

const finalizeExpiredAuctions = async () => {
  const [rows]=await pool.query(
    `SELECT id FROM auctions WHERE (status IN ('scheduled','active') AND ends_at<=NOW())
       OR (status='payment_pending' AND payment_due_at IS NOT NULL AND payment_due_at<=NOW())
     ORDER BY COALESCE(payment_due_at,ends_at) ASC LIMIT 100`
  );
  for (const row of rows) await refreshAuctionById(row.id);
  await processPendingRefunds();
};

const processPendingRefunds=async()=>{
  const [rows]=await pool.query("SELECT id FROM auction_deposits WHERE status='REFUND_PENDING' ORDER BY updated_at ASC LIMIT 50");
  for(const row of rows){
    const conn=await pool.getConnection();
    try{
      await conn.beginTransaction();
      const [[deposit]]=await conn.query('SELECT * FROM auction_deposits WHERE id=? FOR UPDATE',[row.id]);
      if(!deposit||deposit.status!=='REFUND_PENDING'){await conn.rollback();continue;}
      if(!deposit.cashfree_order_id){await conn.query("UPDATE auction_deposits SET status='REFUNDED',refund_status='SUCCESS' WHERE id=?",[deposit.id]);await conn.commit();continue;}
      try{
        let refund;
        if(deposit.refund_id&&deposit.cashfree_refund_id)refund=await cashfree.getRefund({orderId:deposit.cashfree_order_id,refundId:deposit.refund_id});
        else refund=await cashfree.createRefund({orderId:deposit.cashfree_order_id,refundId:deposit.refund_id||`SSADR_${deposit.id}`,amount:deposit.amount});
        const succeeded=refund.refund_status==='SUCCESS';
        await conn.query('UPDATE auction_deposits SET status=?,refund_id=?,cashfree_refund_id=?,refund_status=? WHERE id=?',
          [succeeded?'REFUNDED':'REFUND_PENDING',deposit.refund_id||`SSADR_${deposit.id}`,refund.cf_refund_id||deposit.cashfree_refund_id,refund.refund_status||'PENDING',deposit.id]);
      }catch(error){await conn.query("UPDATE auction_deposits SET refund_status='RETRY_PENDING' WHERE id=?",[deposit.id]);}
      await conn.commit();
    }catch(error){await conn.rollback();throw error;}finally{conn.release();}
  }
};

module.exports={advanceSettlementLocked,configureAuction,finalizeExpiredAuctions,finalizeLockedAuction,httpError,
  minimumNextBid,moneyToCents,processPendingRefunds,refreshAuctionById,refundDeposit,refundNonFinalists,validateAuctionConfig};
