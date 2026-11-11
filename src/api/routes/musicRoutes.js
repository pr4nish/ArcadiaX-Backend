const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');
const { requireAuth } = require('../middleware/auth');

router.get('/status', requireAuth, (req, res) => musicController.getStatus(req, res));
router.post('/control', requireAuth, (req, res) => musicController.control(req, res));

module.exports = router;
