// ── Cart ──────────────────────────────────────────────────────
const express   = require('express');
const cartRouter = express.Router();
const cartCtrl  = require('../controllers/cartController');
const { protect }       = require('../middleware/auth');
const { cartRules, cartUpdateRules, productRules, productUpdateRules, validate } = require('../middleware/validate');

cartRouter.get   ('/',    protect, cartCtrl.getCart);
cartRouter.post  ('/',    protect, cartRules, validate, cartCtrl.addToCart);
cartRouter.put   ('/:id', protect, cartUpdateRules, validate, cartCtrl.updateCartItem);
cartRouter.delete('/',    protect, cartCtrl.clearCart);
cartRouter.delete('/:id', protect, cartCtrl.removeCartItem);

// ── Wishlist ──────────────────────────────────────────────────
const wishRouter = express.Router();
const wishCtrl   = require('../controllers/wishlistController');
const { body }   = require('express-validator');

wishRouter.get   ('/',                 protect, wishCtrl.getWishlist);
wishRouter.get   ('/check/:productId', protect, wishCtrl.checkWishlist);
wishRouter.post  ('/',                 protect,
  [body('product_id').isInt({ gt: 0 })], validate, wishCtrl.addToWishlist
);
wishRouter.delete('/:productId', protect, wishCtrl.removeFromWishlist);

// ── Orders ────────────────────────────────────────────────────
const orderRouter = express.Router();
const orderCtrl   = require('../controllers/orderController');
const paymentCtrl = require('../controllers/paymentController');
const { orderRules } = require('../middleware/validate');
const { authorize }  = require('../middleware/auth');

orderRouter.get   ('/',               protect, orderCtrl.getOrders);
orderRouter.get   ('/:id',            protect, orderCtrl.getOrder);
orderRouter.post  ('/payment/start',  protect, orderRules, validate, paymentCtrl.startFixedPayment);
orderRouter.post  ('/payment/verify', protect,
  [body('cashfree_order_id').trim().notEmpty()], validate, paymentCtrl.verifyPayment);
orderRouter.put   ('/:id/status',     protect, authorize('admin'),
  [body('status').isIn(['pending','confirmed','packaging','shipped','delivered','cancelled','return_requested','returned'])],
  validate, orderCtrl.updateOrderStatus
);
orderRouter.post  ('/:id/return',     protect,
  [body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 2000 })],
  validate, orderCtrl.requestReturn
);
orderRouter.delete('/:id',            protect, orderCtrl.cancelOrder);

// ── Admin ─────────────────────────────────────────────────────
const adminRouter = express.Router();
const adminCtrl   = require('../controllers/adminController');

adminRouter.use(protect, authorize('admin'));
adminRouter.get('/stats',                    adminCtrl.getDashboardStats);
adminRouter.get('/users/all',                adminCtrl.getAllUsers);  // ← MUST be before /users/:id
adminRouter.get('/users',                    adminCtrl.getUsers);
adminRouter.put('/users/:id',
  [
    body('role').optional().isIn(['collector','artist','admin']),
    body('is_active').optional().isBoolean(),
  ],
  validate, adminCtrl.updateUser
);
adminRouter.get('/orders',                   adminCtrl.getAllOrders);

// Products management
adminRouter.get   ('/products',              adminCtrl.getAdminProducts);
adminRouter.post  ('/products',              productRules, validate, adminCtrl.createProduct);
adminRouter.put   ('/products/:id',          productUpdateRules, validate, adminCtrl.updateProduct);
adminRouter.delete('/products/:id',          adminCtrl.deleteProduct);
adminRouter.put   ('/products/:id/restore',  adminCtrl.restoreProduct);

// Artists management
adminRouter.get   ('/artists',               adminCtrl.getArtists);
adminRouter.post  ('/artists',
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('website').optional({ values: 'falsy' }).isURL(),
    body('user_id').optional({ values: 'falsy' }).isInt({ gt: 0 }),
  ],
  validate, adminCtrl.createArtist
);
adminRouter.put   ('/artists/:id',
  [
    body('name').optional().trim().notEmpty().isLength({ max: 100 }),
    body('website').optional({ values: 'falsy' }).isURL(),
    body('user_id').optional({ values: 'falsy' }).isInt({ gt: 0 }),
  ],
  validate, adminCtrl.updateArtist
);
adminRouter.delete('/artists/:id',           adminCtrl.deleteArtist);

// Categories
adminRouter.get   ('/categories',            adminCtrl.getCategories);

module.exports = { cartRouter, wishRouter, orderRouter, adminRouter };
