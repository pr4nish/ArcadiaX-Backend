const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => ticketController.getTickets(req, res));
router.get('/config', requireAuth, (req, res) => ticketController.getConfig(req, res));
router.put('/config', requireAuth, (req, res) => ticketController.updateConfig(req, res));
router.post('/panel', requireAuth, (req, res) => ticketController.sendPanel(req, res));
router.get('/:id', requireAuth, (req, res) => ticketController.getTicket(req, res));
router.post('/:id/close', requireAuth, (req, res) => ticketController.closeTicket(req, res));

module.exports = router;
