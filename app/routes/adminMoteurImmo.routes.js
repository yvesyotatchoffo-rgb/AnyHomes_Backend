const controller = require('../controllers/AdminMoteurImmoController');
const { adminAuth } = require('../middleware/adminAuth');
const router = require('express').Router();

router.get('/stats', adminAuth, controller.stats);

module.exports = router;
