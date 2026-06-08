const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicController');
const requestCtrl = require('../controllers/serviceRequestController');
const {
  validateCreateOrder,
  validateCreateReview,
  validateCreateCancellationRequest,
  validatePagination,
} = require('../validation/schemas');

// Services
router.get('/services', validatePagination, ctrl.listServices);
router.get('/services/:id', ctrl.getServiceDetail);
router.get('/favorite-pros', ctrl.listFavoritePros);

// Statistiques publiques d'un pro
router.get('/pro-stats/:proId', ctrl.getProPublicStats);

// Catégories
router.get('/categories', ctrl.listCategories);

// Paramètres publics (paymentInfo, etc.)
router.get('/settings', ctrl.getPublicSettings);

// Commandes (acheteur authentifié)
router.post('/orders', validateCreateOrder, ctrl.createOrder);
router.get('/orders', validatePagination, ctrl.listOrders);
router.get('/orders/:id', ctrl.getOrderDetail);
router.post('/orders/:id/pay', ctrl.createPaymentIntent);
router.post('/orders/:id/confirm', ctrl.confirmOrderDelivery);
router.post('/orders/:id/cancellation-request', validateCreateCancellationRequest, ctrl.requestCancellation);
router.post('/orders/:id/cancellation/accept', ctrl.acceptCancellationRequest);
router.post('/orders/:id/cancellation/reject', ctrl.rejectCancellationRequest);
router.post('/orders/:id/litigation', ctrl.openLitigation);

// Avis
router.post('/reviews', validateCreateReview, ctrl.createReview);

// Favoris
router.get('/favorites', validatePagination, ctrl.listFavorites);
router.post('/favorites/:serviceId', ctrl.toggleFavorite);

// Demandes de service (auth requise)
router.post('/requests', requestCtrl.createRequest);
router.get('/requests/mine', requestCtrl.listMyRequests);

module.exports = router;
