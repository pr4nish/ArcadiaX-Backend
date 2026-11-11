const express = require('express');
const router = express.Router();
const autoroleController = require('../controllers/autoroleController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => autoroleController.getConfig(req, res));
router.put('/', requireAuth, (req, res) => autoroleController.updateConfig(req, res));

module.exports = router;
