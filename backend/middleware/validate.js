const { body, param, query, validationResult } = require('express-validator');

// Collect validation errors and return 422 if any
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth rules ───────────────────────────────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const auctionFields = [
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

// ── Product rules ────────────────────────────────────────────
const productRules = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('price').isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('artist_id').isInt({ gt: 0 }).withMessage('Valid artist ID required'),
  body('category_id').isInt({ gt: 0 }).withMessage('Valid category ID required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  ...auctionFields,
];

// ── Order rules ──────────────────────────────────────────────
const orderRules = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.product_id').isInt({ gt: 0 }).withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ gt: 0 }).withMessage('Quantity must be at least 1'),
  body('shipping_name').trim().notEmpty().withMessage('Shipping name is required'),
  body('shipping_addr').trim().notEmpty().withMessage('Shipping address is required'),
];

// ── Cart rules ───────────────────────────────────────────────
const cartRules = [
  body('product_id').isInt({ gt: 0 }).withMessage('Valid product ID required'),
  body('quantity').optional().isInt({ gt: 0 }).withMessage('Quantity must be at least 1'),
];

const cartUpdateRules = [
  body('quantity').isInt({ gt: 0 }).withMessage('Quantity must be a positive integer'),
];

const productUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }),
  body('price').optional().isFloat({ gt: 0 }).withMessage('Price must be greater than 0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('artist_id').optional().isInt({ gt: 0 }).withMessage('Valid artist ID required'),
  body('category_id').optional().isInt({ gt: 0 }).withMessage('Valid category ID required'),
  body('year').optional({ values: 'falsy' }).isInt({ min: 1000, max: 9999 }).withMessage('Year must be valid'),
  ...auctionFields,
];

// ── Review rules ─────────────────────────────────────────────
const reviewRules = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Written review is required').isLength({ max: 1000 }),
];

// ── Param rules ──────────────────────────────────────────────
const idParam = [
  param('id').isInt({ gt: 0 }).withMessage('Invalid ID parameter'),
];

module.exports = {
  validate,
  registerRules, loginRules,
  productRules,  orderRules,
  cartRules,     cartUpdateRules,
  productUpdateRules, reviewRules,
  idParam,
};
