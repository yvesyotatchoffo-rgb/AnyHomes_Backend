const controller = require('../controllers/AgencyRevealController');
const { adminAuth } = require('../middleware/adminAuth');
const router = require('express').Router();

router.post('/log', controller.log);
router.get('/list', adminAuth, controller.list);

module.exports = router;
