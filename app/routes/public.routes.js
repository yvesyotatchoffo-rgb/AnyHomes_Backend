const router = require('express').Router();
const publicAgency = require('../controllers/PublicAgencyController');

router.get('/agency/check-slug', publicAgency.checkSlug);
router.get('/agency/:slug', publicAgency.getAgencyBySlug);

module.exports = router;