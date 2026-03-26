const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const { protect }                                          = require('../middleware/auth');
const { registerRules, loginRules, validate }              = require('../middleware/validate');
const { body }                                             = require('express-validator');

router.post('/register',         registerRules, validate, ctrl.register);
router.post('/login',            loginRules,    validate, ctrl.login);
router.get ('/me',               protect,                 ctrl.getMe);
router.put ('/update-profile',   protect,                 ctrl.updateProfile);
router.put ('/change-password',  protect,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 6 })],
  validate, ctrl.changePassword
);

module.exports = router;
