const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimiter');

router.post('/send', requireAuth, actionLimiter, (req, res) => messageController.sendMessage(req, res));
router.get('/history', requireAuth, (req, res) => messageController.getHistory(req, res));

module.exports = router;
