// routes/artist.js
const express        = require('express');
const router         = express.Router();
const artistCtrl     = require('../controllers/artistController');
const { protect, authorize } = require('../middleware/auth');

// All routes require login + artist role
router.use(protect, authorize('artist'));

router.get   ('/me',            artistCtrl.getMe);
router.get   ('/stats',         artistCtrl.getStats);
router.get   ('/artworks',      artistCtrl.getArtworks);
router.post  ('/artworks',      artistCtrl.createArtwork);
router.put   ('/artworks/:id',  artistCtrl.updateArtwork);
router.delete('/artworks/:id',  artistCtrl.deleteArtwork);
router.get   ('/sales',         artistCtrl.getSales);

module.exports = router;
