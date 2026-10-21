// routes/artist.js
const express        = require('express');
const router         = express.Router();
const artistCtrl     = require('../controllers/artistController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { productUpdateRules, validate } = require('../middleware/validate');

const artworkCreateRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('category_id').isInt({ gt: 0 }).withMessage('Valid category ID required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('year').optional({ values: 'falsy' }).isInt({ min: 1000, max: 9999 }).withMessage('Year must be valid'),
  body('sale_type').optional().isIn(['fixed', 'auction']).withMessage('Sale type must be fixed or auction'),
  body('auction_starting_price').optional().isFloat({ gt: 0 }).withMessage('Starting bid must be greater than 0'),
  body('reserve_price').optional().isFloat({ gt: 0 }).withMessage('Reserve price must be greater than 0'),
  body('deposit_amount').optional().isFloat({ gt: 0 }).withMessage('Security deposit must be greater than 0'),
  body('payment_window_hours').optional().isInt({ min: 1, max: 168 }).withMessage('Payment window must be 1-168 hours'),
  body('second_chance_window_hours').optional().isInt({ min: 1, max: 168 }).withMessage('Second-chance window must be 1-168 hours'),
  body('minimum_increment').optional().isFloat({ gt: 0 }).withMessage('Minimum increment must be greater than 0'),
  body('starts_at').optional().isISO8601().withMessage('Auction start must be a valid date'),
  body('ends_at').optional().isISO8601().withMessage('Auction end must be a valid date'),
];

// Public artist directory
router.get('/', artistCtrl.getPublicArtists);

// All remaining routes require login + artist role
router.use(protect, authorize('artist'));

router.get   ('/me',            artistCtrl.getMe);
router.get   ('/stats',         artistCtrl.getStats);
router.get   ('/artworks',      artistCtrl.getArtworks);
router.post  ('/artworks',      artworkCreateRules, validate, artistCtrl.createArtwork);
router.put   ('/artworks/:id',  productUpdateRules, validate, artistCtrl.updateArtwork);
router.delete('/artworks/:id',  artistCtrl.deleteArtwork);
router.get   ('/sales',         artistCtrl.getSales);

module.exports = router;
