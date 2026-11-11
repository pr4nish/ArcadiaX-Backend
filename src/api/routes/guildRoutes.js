const express = require('express');
const router = express.Router();
const guildController = require('../controllers/guildController');
const { requireAuth } = require('../middleware/auth');

router.get('/channels', requireAuth, (req, res) => guildController.getChannels(req, res));
router.get('/roles', requireAuth, (req, res) => guildController.getRoles(req, res));
router.get('/members', requireAuth, (req, res) => guildController.getMembers(req, res));

module.exports = router;
