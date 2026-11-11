const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => logsController.getLogs(req, res));
router.get('/:type', requireAuth, (req, res) => logsController.getLogsByType(req, res));

module.exports = router;
