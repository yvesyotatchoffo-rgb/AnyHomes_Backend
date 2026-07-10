const controller = require('../controllers/ImportRunController');
const { adminAuth } = require('../middleware/adminAuth');
const router = require('express').Router();

router.get('/list', adminAuth, controller.list);

module.exports = router;
