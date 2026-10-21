const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { protect }                                          = require('../middleware/auth');
const { registerRules, loginRules, validate }              = require('../middleware/validate');
const { body }                                             = require('express-validator');

router.post('/register',         registerRules, validate, ctrl.register);
router.post('/login',            loginRules,    validate, ctrl.login);
router.post('/google',
  [body('credential').isString().notEmpty().withMessage('Google credential is required')],
  validate, ctrl.googleLogin
);
router.get('/google/config', (req, res) => res.json({
  success: true,
  client_id: process.env.GOOGLE_CLIENT_ID || null,
  configured: Boolean(process.env.GOOGLE_CLIENT_ID),
}));
router.get ('/me',               protect,                 ctrl.getMe);
router.put ('/update-profile',   protect,
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  ],
  validate, ctrl.updateProfile
);
router.put ('/change-password',  protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, ctrl.changePassword
);

module.exports = router;
