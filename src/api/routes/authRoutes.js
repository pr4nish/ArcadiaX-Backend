const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

router.get('/discord', authLimiter, authController.discordLogin);
router.get('/callback', authLimiter, (req, res, next) => authController.discordCallback(req, res, next));
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', authController.logout);

module.exports = router;
