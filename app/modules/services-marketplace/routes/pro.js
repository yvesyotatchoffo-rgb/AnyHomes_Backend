const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/proController');
const {
  validateCreateService,
  validateUpdateService,
  validateCreateCancellationRequest,
  validatePagination,
} = require('../validation/schemas');

// Dashboard
router.get('/dashboard', ctrl.getProDashboard);

// Stripe Connect
router.post('/stripe/onboard', ctrl.stripeOnboard);
router.get('/stripe/status', ctrl.stripeStatus);

// Services
router.get('/services', validatePagination, ctrl.listProServices);
router.post('/services', validateCreateService, ctrl.createProService);
router.put('/services/:id', validateUpdateService, ctrl.updateProService);
router.delete('/services/:id', ctrl.deleteProService);

// Commandes
router.get('/orders', validatePagination, ctrl.listProOrders);
router.post('/orders/:id/accept', ctrl.acceptOrder);
router.post('/orders/:id/deliver', ctrl.deliverOrder);
router.post('/orders/:id/cancellation-request', validateCreateCancellationRequest, ctrl.requestCancellation);
router.post('/orders/:id/cancellation/accept', ctrl.acceptCancellationRequest);
router.post('/orders/:id/cancellation/reject', ctrl.rejectCancellationRequest);
router.post('/orders/:id/litigation', ctrl.openLitigation);

// Versements (payouts versés au pro)
router.get('/payouts', ctrl.listProPayouts);

// Avis
router.get('/reviews', validatePagination, ctrl.listProReviews);

module.exports = router;
