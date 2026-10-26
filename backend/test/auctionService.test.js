process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  advanceSettlementLocked,
  finalizeLockedAuction,
  minimumNextBid,
  moneyToCents,
  validateAuctionConfig,
} = require('../utils/auctionService');
const { maskBidderName } = require('../controllers/auctionController');
const { isTransientDatabaseError } = require('../middleware/error');

test('transient database errors are safely identified for retry responses', () => {
  assert.equal(isTransientDatabaseError({ code:'ENOTFOUND' }), true);
  assert.equal(isTransientDatabaseError({ code:'PROTOCOL_CONNECTION_LOST' }), true);
  assert.equal(isTransientDatabaseError({ code:'ER_ACCESS_DENIED_ERROR' }), false);
});

test('moneyToCents accepts valid money and rejects non-positive values', () => {
  assert.equal(moneyToCents('123.45'), 12345);
  assert.equal(moneyToCents(0), null);
  assert.equal(moneyToCents('not-money'), null);
});

test('minimumNextBid uses starting price, then the configured increment', () => {
  assert.equal(minimumNextBid({ starting_price:'1000.00', current_bid:null, minimum_increment:'100.00' }), 1000);
  assert.equal(minimumNextBid({ starting_price:'1000.00', current_bid:'1250.00', minimum_increment:'100.00' }), 1350);
});

test('validateAuctionConfig validates dates and normalizes values', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const config = validateAuctionConfig({
    auction_starting_price:'5000.00', minimum_increment:'250.00',
    starts_at:'2026-01-02T00:00:00.000Z', ends_at:'2026-01-03T00:00:00.000Z',
  }, now);
  assert.equal(config.startingPrice, 5000);
  assert.equal(config.minimumIncrement, 250);
  assert.equal(config.reservePrice, 5000);
  assert.equal(config.depositAmount, 500);
  assert.equal(config.paymentWindowHours, 48);
  assert.equal(config.status, 'scheduled');
  assert.throws(() => validateAuctionConfig({
    auction_starting_price:5000, minimum_increment:250,
    starts_at:'2026-01-03T00:00:00.000Z', ends_at:'2026-01-02T00:00:00.000Z',
  }, now), /after its start/);
  assert.throws(() => validateAuctionConfig({
    auction_starting_price:5000, reserve_price:4500, minimum_increment:250,
    starts_at:'2026-01-02T00:00:00.000Z', ends_at:'2026-01-03T00:00:00.000Z',
  }, now), /Reserve price/);
});

test('finalization reserves artwork only when the highest bid meets reserve', async () => {
  const statements = [];
  const conn = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('FROM bids')) return [[{ user_id:7, final_bid:'900.00' }]];
    if (sql.includes('SELECT user_id FROM auction_deposits')) return [[]];
    return [{}];
  }};
  const result = await finalizeLockedAuction(conn, { id:3, product_id:11, reserve_price:'1000.00' });
  assert.equal(result, null);
  assert.ok(statements.some(([sql]) => sql.includes("status='unsold'")));
  assert.ok(statements.some(([sql, params]) => sql.includes('UPDATE products SET stock=1') && params[0] === 11));
});

test('finalization records the winner and payment-pending reservation', async () => {
  const statements = [];
  const conn = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('FROM bids')) return [[{ user_id:7, final_bid:'1250.00' }]];
    if (sql.includes('SELECT user_id FROM auction_deposits')) return [[]];
    return [{}];
  }};
  const result = await finalizeLockedAuction(conn, { id:3, product_id:11, reserve_price:'1000.00' });
  assert.deepEqual(result, { user_id:7, final_bid:'1250.00' });
  assert.ok(statements.some(([sql]) => sql.includes("status='payment_pending'")));
  assert.ok(statements.some(([sql, params]) => sql.includes('UPDATE products SET stock=0') && params[0] === 11));
});

test('original winner default forfeits only their deposit and offers bidder two', async () => {
  const statements = [];
  const conn = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('SELECT c.*')) return [[{ id:22, user_id:8, final_bid:'1200.00', bidder_rank:2 }]];
    if (sql.includes('SELECT user_id FROM auction_deposits')) return [[]];
    return [{ affectedRows:1 }];
  }};
  const next = await advanceSettlementLocked(conn, {
    id:3, product_id:11, active_bidder_rank:1, active_buyer_user_id:7, second_chance_window_hours:24,
  });
  assert.equal(next.user_id, 8);
  assert.ok(statements.some(([sql, params]) => sql.includes("status='FORFEITED'") && params[1] === 7));
  assert.ok(statements.some(([sql]) => sql.includes("settlement_status='SECOND_CHANCE'")));
});

test('backup bidder timeout refunds their deposit and never forfeits it', async () => {
  const statements = [];
  const conn = { query: async (sql, params) => {
    statements.push([sql, params]);
    if (sql.includes('SELECT c.*')) return [[]];
    if (sql.includes('SELECT * FROM auction_deposits')) return [[{ id:12, auction_id:3, user_id:8, amount:'500.00', status:'HELD', cashfree_order_id:null }]];
    if (sql.includes('SELECT user_id FROM auction_deposits')) return [[]];
    return [{ affectedRows:1 }];
  }};
  await advanceSettlementLocked(conn, {
    id:3, product_id:11, active_bidder_rank:2, active_buyer_user_id:8, second_chance_window_hours:24,
  });
  assert.ok(statements.some(([sql]) => sql.includes("status='REFUNDED'")));
  assert.ok(!statements.some(([sql, params]) => sql.includes("status='FORFEITED'") && params?.[1] === 8));
  assert.ok(statements.some(([sql]) => sql.includes("settlement_status='UNSOLD'")));
});

test('public bidder names reveal initials only', () => {
  assert.equal(maskBidderName('Priya Sharma'), 'P••• S.');
  assert.equal(maskBidderName('Arjun'), 'A•••');
});
