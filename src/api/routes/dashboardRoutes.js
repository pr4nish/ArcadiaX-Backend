const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

router.get('/overview', requireAuth, (req, res, next) => dashboardController.getOverview(req, res, next));
router.get('/status', requireAuth, (req, res, next) => dashboardController.getStatus(req, res, next));

module.exports = router;
