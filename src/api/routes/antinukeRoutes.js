const express = require('express');
const router = express.Router();
const antinukeController = require('../controllers/antinukeController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => antinukeController.getConfig(req, res));
router.put('/', requireAuth, (req, res) => antinukeController.updateConfig(req, res));
router.get('/logs', requireAuth, (req, res) => antinukeController.getLogs(req, res));
router.post('/lockdown', requireAuth, (req, res) => antinukeController.toggleLockdown(req, res));
router.post('/trusted', requireAuth, (req, res) => antinukeController.addTrustedUser(req, res));
router.delete('/trusted/:id', requireAuth, (req, res) => antinukeController.removeTrustedUser(req, res));

module.exports = router;
