const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const requestCtrl = require('../controllers/serviceRequestController');
const partnerCtrl = require('../controllers/partnerController');
const seedMarketplace = require('../seed/seedMarketplace');
const {
  validateCreateCategory,
  validateResolveLitigation,
  validatePagination,
} = require('../validation/schemas');

// Statistiques
router.get('/stats', ctrl.getStats);

// Services
router.get('/services', validatePagination, ctrl.listAllServices);
router.get('/services/export', ctrl.exportServicesCsv);
router.post('/services/:id/validate', ctrl.validateService);
router.post('/services/:id/reject', ctrl.rejectService);
router.put('/services/:id/featured', ctrl.setFeaturedService);

// Catégories
router.get('/categories', ctrl.listCategories);
router.post('/categories', validateCreateCategory, ctrl.createCategory);
router.put('/categories/:id', ctrl.updateCategory);
router.delete('/categories/:id', ctrl.deleteCategory);

// Commandes
router.get('/orders', validatePagination, ctrl.listAllOrders);
router.get('/orders/:id', ctrl.getOrderDetail);
router.get('/users/:userId/orders', ctrl.listUserOrders);
router.get('/users/:userId/favorites', ctrl.listUserFavorites);
router.get('/orders/export', ctrl.exportOrdersCsv);
router.get('/litigations', validatePagination, ctrl.listAllLitigations);
router.get('/litigations/:id', ctrl.getLitigationDetail);
router.get('/litigations/export', ctrl.exportLitigationsCsv);
router.get('/cancellations', validatePagination, ctrl.listAllCancellations);
router.get('/cancellations/export', ctrl.exportCancellationsCsv);
router.post('/orders/:id/resolve-litigation', validateResolveLitigation, ctrl.resolveLitigation);

// Avis
router.get('/reviews', validatePagination, ctrl.listAllReviews);
router.delete('/reviews/:id', ctrl.deleteReview);

// Seed / Init démo
router.post('/seed', async (req, res) => {
  try {
    const { demoProId } = req.body;
    const results = await seedMarketplace(demoProId);
    return res.json({ success: true, message: 'Seed terminé', results });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur seed', error: err.message });
  }
});

// Demandes de service (admin)
router.get('/requests', requestCtrl.adminListRequests);
router.get('/requests/:id', requestCtrl.adminGetRequestDetail);
router.patch('/requests/:id/status', requestCtrl.adminUpdateStatus);
router.delete('/requests/:id', requestCtrl.adminDeleteRequest);

// Paramètres marketplace
router.get('/settings', ctrl.getMarketplaceSettings);
router.put('/settings', ctrl.updateMarketplaceSettings);

// Partenaires (Pros avec services à la carte)
router.get('/partners', partnerCtrl.listPartners);
router.get('/partners/:id', partnerCtrl.getPartnerDetail);
router.get('/partners/:id/transactions', partnerCtrl.listPartnerTransactions);
router.get('/partners/:id/services', partnerCtrl.listPartnerServices);
router.get('/partners/:id/properties', partnerCtrl.listPartnerProperties);
router.get('/partners/:id/reviews', partnerCtrl.listPartnerReviews);
router.put('/partners/:id/flags', partnerCtrl.updatePartnerFlags);
router.put('/partners/:id/bio', partnerCtrl.updatePartnerBio);

module.exports = router;
