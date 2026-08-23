const router = require('express').Router();
const publicAgency = require('../controllers/PublicAgencyController');

router.get('/agency/check-slug', publicAgency.checkSlug);
router.get('/agency/:slug', publicAgency.getAgencyBySlug);
router.post('/agency/:slug/view', publicAgency.incrementView);

module.exports = router;