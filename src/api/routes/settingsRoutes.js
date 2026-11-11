const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => settingsController.getSettings(req, res));
router.put('/', requireAuth, (req, res) => settingsController.updateSettings(req, res));

module.exports = router;
