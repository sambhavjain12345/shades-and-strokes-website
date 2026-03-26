// ── Cart ──────────────────────────────────────────────────────
const express   = require('express');
const cartRouter = express.Router();
const cartCtrl  = require('../controllers/cartController');
const { protect }       = require('../middleware/auth');
const { cartRules, validate } = require('../middleware/validate');

cartRouter.get   ('/',    protect, cartCtrl.getCart);
cartRouter.post  ('/',    protect, cartRules, validate, cartCtrl.addToCart);
cartRouter.put   ('/:id', protect, cartCtrl.updateCartItem);
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
const { orderRules } = require('../middleware/validate');
const { authorize }  = require('../middleware/auth');

orderRouter.get   ('/',         protect, orderCtrl.getOrders);
orderRouter.get   ('/:id',      protect, orderCtrl.getOrder);
orderRouter.post  ('/',         protect, orderRules, validate, orderCtrl.placeOrder);
orderRouter.put   ('/:id/status', protect, authorize('admin'), orderCtrl.updateOrderStatus);
orderRouter.delete('/:id',      protect, orderCtrl.cancelOrder);

// ── Admin ─────────────────────────────────────────────────────
const adminRouter = express.Router();
const adminCtrl   = require('../controllers/adminController');

adminRouter.use(protect, authorize('admin'));
adminRouter.get('/stats',                    adminCtrl.getDashboardStats);
adminRouter.get('/users',                    adminCtrl.getUsers);
adminRouter.get('/users/all',                adminCtrl.getAllUsers);
adminRouter.put('/users/:id',                adminCtrl.updateUser);
adminRouter.get('/orders',                   adminCtrl.getAllOrders);

// Products management
adminRouter.get   ('/products',              adminCtrl.getAdminProducts);
adminRouter.post  ('/products',              adminCtrl.createProduct);
adminRouter.put   ('/products/:id',          adminCtrl.updateProduct);
adminRouter.delete('/products/:id',          adminCtrl.deleteProduct);
adminRouter.put   ('/products/:id/restore',  adminCtrl.restoreProduct);

// Artists management
adminRouter.get   ('/artists',               adminCtrl.getArtists);
adminRouter.post  ('/artists',               adminCtrl.createArtist);
adminRouter.put   ('/artists/:id',           adminCtrl.updateArtist);
adminRouter.delete('/artists/:id',           adminCtrl.deleteArtist);

// Categories
adminRouter.get   ('/categories',            adminCtrl.getCategories);

module.exports = { cartRouter, wishRouter, orderRouter, adminRouter };
