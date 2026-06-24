const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route này Public cho Citizen chat
router.post('/chat', aiController.chat);

module.exports = router;
