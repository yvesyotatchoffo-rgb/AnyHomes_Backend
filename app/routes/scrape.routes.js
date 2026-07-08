const scrape = require('../controllers/ScrapeController');
const router = require('express').Router();

router.post('/import', scrape.scrapeAndImport);
router.post('/manual', scrape.manualImport);
router.get('/preview', scrape.preview);

module.exports = router;
