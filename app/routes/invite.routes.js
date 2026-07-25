const express = require('express');
const router = express.Router();
const controller = require('../controllers/InviteController');
const auth = require('../middleware/auth');

router.post('/create', auth, (req, res) => controller.create(req, res));

router.get('/:token', (req, res) => controller.get(req, res));

router.post('/accept/:token', auth, (req, res) => controller.accept(req, res));

module.exports = router;
