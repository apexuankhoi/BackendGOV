const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/summary', authMiddleware, notificationController.getNotificationSummary);

module.exports = router;
