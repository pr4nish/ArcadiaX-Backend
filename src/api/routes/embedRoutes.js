const express = require('express');
const router = express.Router();
const embedController = require('../controllers/embedController');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimiter');

router.post('/preview', requireAuth, (req, res) => embedController.preview(req, res));
router.post('/send', requireAuth, actionLimiter, (req, res) => embedController.send(req, res));

module.exports = router;
