const express = require('express');
const multer = require('multer');
const upload = multer();
const router = express.Router();
const ctrl = require('../controllers/qrFlyerController');

router.use((req, res, next) => {
  console.log('QR route received:', {
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    headers: {
      authorization: req.headers.authorization ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
    },
  });
  next();
});

router.get('/properties', ctrl.listOwnerProperties);
router.get('/properties/:propertyId/setup', ctrl.getPropertySetup);
router.get('/properties/:propertyId/flyer', ctrl.getPropertyFlyer);
router.delete('/properties/:propertyId/flyer', ctrl.deletePropertyFlyer);
router.get('/flyers', ctrl.listFlyers);
router.post('/flyers', upload.none(), ctrl.createFlyer);
router.post('/flyers/debug', upload.none(), ctrl.debugCreateFlyer);
router.get('/debug', ctrl.debugPing);
router.get('/flyers/:flyerId/download', ctrl.downloadFlyer);
router.delete('/flyers/:flyerId', ctrl.deleteFlyer);

// Admin routes
router.get('/admin/stats', ctrl.adminStats);
router.get('/admin/flyers', ctrl.adminListFlyers);

module.exports = router;
