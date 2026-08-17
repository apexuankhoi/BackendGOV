const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/send-otp', authController.sendOtp);
router.post('/login', authController.login);
router.post('/ekyc-citizen', authController.ekycCitizen);
router.post('/refresh', authController.refreshToken);
router.post('/refresh-token', authController.refreshToken);
router.put('/change-password', authMiddleware, authController.changePassword);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
