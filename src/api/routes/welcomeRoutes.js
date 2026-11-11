const express = require('express');
const router = express.Router();
const welcomeController = require('../controllers/welcomeController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => welcomeController.getConfig(req, res));
router.put('/', requireAuth, (req, res) => welcomeController.updateConfig(req, res));
router.post('/preview', requireAuth, (req, res) => welcomeController.preview(req, res));

module.exports = router;
