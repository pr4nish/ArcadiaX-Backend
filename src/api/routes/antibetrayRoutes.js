const express = require('express');
const router = express.Router();
const antibetrayController = require('../controllers/antibetrayController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => antibetrayController.getConfig(req, res));
router.put('/', requireAuth, (req, res) => antibetrayController.updateConfig(req, res));
router.get('/logs', requireAuth, (req, res) => antibetrayController.getLogs(req, res));

module.exports = router;
