const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { requireAuth } = require('../middleware/auth');
const { actionLimiter } = require('../middleware/rateLimiter');

router.get('/', requireAuth, (req, res) => backupController.getBackups(req, res));
router.post('/', requireAuth, actionLimiter, (req, res) => backupController.createBackup(req, res));
router.get('/:id', requireAuth, (req, res) => backupController.getBackup(req, res));
router.get('/:id/export', requireAuth, (req, res) => backupController.exportBackup(req, res));
router.post('/:id/restore', requireAuth, actionLimiter, (req, res) => backupController.restoreBackup(req, res));
router.delete('/:id', requireAuth, (req, res) => backupController.deleteBackup(req, res));

module.exports = router;
