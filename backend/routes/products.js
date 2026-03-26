const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/productController');
const { protect, authorize, optionalAuth }    = require('../middleware/auth');
const { productRules, reviewRules, validate } = require('../middleware/validate');

// Public routes
router.get ('/',               ctrl.getProducts);
router.get ('/categories',     ctrl.getCategories);
router.get ('/stats/public',   ctrl.getPublicStats);
router.get ('/:id',            ctrl.getProduct);
router.get ('/:id/reviews',    ctrl.getReviews);

// Collector routes
router.post('/:id/reviews', protect, reviewRules, validate, ctrl.addReview);

// Admin / artist routes
router.post('/',    protect, authorize('admin', 'artist'), productRules, validate, ctrl.createProduct);
router.put ('/:id', protect, authorize('admin', 'artist'),               ctrl.updateProduct);
router.delete('/:id', protect, authorize('admin'),                       ctrl.deleteProduct);

module.exports = router;
