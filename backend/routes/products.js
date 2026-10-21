const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/productController');
const adminCtrl = require('../controllers/adminController');
const { protect, authorize }                  = require('../middleware/auth');
const { productRules, reviewRules, validate } = require('../middleware/validate');

// Public routes
router.get ('/',               ctrl.getProducts);
router.get ('/categories',     ctrl.getCategories);
router.get ('/stats/public',   ctrl.getPublicStats);
router.get ('/:id',            ctrl.getProduct);
router.get ('/:id/reviews',    ctrl.getReviews);

// Collector routes
router.post('/:id/reviews', protect, reviewRules, validate, ctrl.addReview);
router.get ('/:id/review-eligibility', protect, ctrl.getReviewEligibility);

// Admin routes. Artists use /api/artist/artworks, which enforces ownership.
router.post('/',    protect, authorize('admin'), productRules, validate, adminCtrl.createProduct);
router.put ('/:id', protect, authorize('admin'),                         adminCtrl.updateProduct);
router.delete('/:id', protect, authorize('admin'),                       adminCtrl.deleteProduct);

module.exports = router;
