const controller = require('../controllers/ExternalListingController');
const { adminAuth } = require('../middleware/adminAuth');
const router = require('express').Router();

router.get('/list', adminAuth, controller.list);
router.get('/detail/:id', adminAuth, controller.detail);

module.exports = router;
