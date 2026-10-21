const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/auctionController');
const paymentController = require('../controllers/paymentController');
const { optionalAuth, protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.get('/', controller.getAuctions);
router.post('/webhook/cashfree', controller.cashfreeWebhook);
router.post('/settle', controller.runSettlement);
router.get('/won', protect, controller.getWonAuctions);
router.get('/product/:productId', optionalAuth, controller.getProductAuction);
router.post('/:id/deposit', protect, controller.holdDeposit);
router.post('/:id/deposit/verify', protect, controller.verifyDeposit);
router.post('/:id/decline', protect, controller.declineOffer);
router.post('/:id/payment/start', protect, [
  body('shipping_name').trim().notEmpty(), body('shipping_addr').trim().notEmpty(),
  body('shipping_phone').trim().notEmpty(), body('notes').optional({values:'falsy'}).trim().isLength({max:2000}),
], validate, paymentController.startAuctionPayment);
router.post('/:id/payment/verify', protect,
  [body('cashfree_order_id').trim().notEmpty()], validate, paymentController.verifyPayment);
router.post(
  '/:id/bids',
  protect,
  [body('amount').notEmpty().withMessage('Bid amount is required')],
  validate,
  controller.placeBid
);

module.exports = router;
