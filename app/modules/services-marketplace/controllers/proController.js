const ProServiceEn = require('../models/ProService_en.model');
const ProServiceFr = require('../models/ProService_fr.model');
const ServiceOrderEn = require('../models/ServiceOrder_en.model');
const ServiceOrderFr = require('../models/ServiceOrder_fr.model');
const ServiceReviewEn = require('../models/ServiceReview_en.model');
const ServiceReviewFr = require('../models/ServiceReview_fr.model');
const MarketplaceSettings = require('../models/MarketplaceSettings.model');
const stripeService = require('../services/stripeMarketplaceService');

function getModels(lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return {
    ProService: l === 'en' ? ProServiceEn : ProServiceFr,
    ServiceOrder: l === 'en' ? ServiceOrderEn : ServiceOrderFr,
    ServiceReview: l === 'en' ? ServiceReviewEn : ServiceReviewFr,
  };
}

/**
 * POST /pro/marketplace/services
 * Créer un nouveau service (pro authentifié)
 */
exports.createProService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const proId = req.identity && req.identity._id;
    console.log(`[PRO-SVC] createProService called - proId=${proId} body=${JSON.stringify(req.body).slice(0,200)}`);
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { title, description, summary, d1, category, priceTTC, quantity, quantity_label, modality, city, radiusKm, delivery_time, imageUrls } = req.body;

    if (!title || !category || priceTTC === undefined || !city || !radiusKm) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants : title, category, priceTTC, city, radiusKm' });
    }
    if (priceTTC < 0 || radiusKm <= 0) {
      return res.status(400).json({ success: false, message: 'priceTTC doit être >= 0 et radiusKm > 0' });
    }
    if (quantity !== undefined && Number(quantity) <= 0) {
      return res.status(400).json({ success: false, message: 'quantity doit être > 0 si renseignée' });
    }

    // draft=true → brouillon, draft=false → soumettre à validation (ou activer si auto-validation)
    const isDraft = req.body.draft !== false;
    let initialStatus = 'draft';
    if (!isDraft) {
      const settings = await MarketplaceSettings.findOne();
      initialStatus = (settings && settings.autoValidateServices) ? 'active' : 'pending_validation';
    }

    const service = await ProService.create({
      title, description, summary, d1, category,
      pro: proId,
      priceTTC,
      ...(quantity !== undefined ? { quantity } : {}),
      ...(quantity_label !== undefined ? { quantity_label } : {}),
      modality: modality || 'Présentiel',
      city, radiusKm,
      delivery_time: delivery_time || undefined,
      imageUrls: imageUrls || [],
      status: initialStatus,
    });
    console.log(`[PRO-SVC] createProService created id=${service._id} status=${initialStatus}`);

    const msg = initialStatus === 'active'
      ? 'Service créé et activé automatiquement'
      : initialStatus === 'pending_validation'
        ? 'Service soumis à validation admin'
        : 'Service enregistré en brouillon';
    return res.status(201).json({ success: true, data: service, message: msg });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /pro/marketplace/services
 * Liste des services du pro connecté
 */
exports.listProServices = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { pro: proId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [services, total] = await Promise.all([
      ProService.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('category', 'name'),
      ProService.countDocuments(filter),
    ]);

    return res.json({ success: true, data: services, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * PUT /pro/marketplace/services/:id
 * Modifier un service (pro propriétaire, statut draft ou inactive seulement)
 */
exports.updateProService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const service = await ProService.findOne({ _id: req.params.id, pro: proId });
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    if (service.status === 'pending_validation') {
      return res.status(400).json({ success: false, message: 'Ce service est en attente de validation admin et ne peut pas être modifié' });
    }

    const allowed = ['title', 'description', 'summary', 'd1', 'priceTTC', 'quantity', 'quantity_label', 'modality', 'city', 'radiusKm', 'delivery_time', 'imageUrls'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) service[field] = req.body[field];
    });

    // Explicit status override (e.g. activate → pending_validation or deactivate → inactive)
    if (req.body.status === 'inactive') {
      service.status = 'inactive';
    } else if (req.body.status === 'active') {
      // Pro tries to activate: submit for validation (or auto-validate)
      const settings = await MarketplaceSettings.findOne();
      service.status = (settings && settings.autoValidateServices) ? 'active' : 'pending_validation';
    } else if (req.body.draft === false) {
      // Save + submit — if already active, keep active (no re-validation needed)
      if (service.status !== 'active') {
        const settings = await MarketplaceSettings.findOne();
        service.status = (settings && settings.autoValidateServices) ? 'active' : 'pending_validation';
      }
    } else if (req.body.draft === true) {
      service.status = 'draft';
    }
    // If no status/draft directive: preserve current status (active service stays active after edit)
    await service.save();

    return res.json({ success: true, data: service, message: 'Service mis à jour' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * DELETE /pro/marketplace/services/:id
 * Supprimer (soft delete) un service du pro
 */
exports.deleteProService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const service = await ProService.findOne({ _id: req.params.id, pro: proId });
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    if (service.status === 'deleted') return res.status(400).json({ success: false, message: 'Déjà supprimé' });

    service.status = 'deleted';
    await service.save();

    return res.json({ success: true, message: 'Service supprimé' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /pro/marketplace/orders
 * Liste des commandes reçues par le pro
 */
exports.listProOrders = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { status, page = 1, limit = 20 } = req.query;
    const proServices = await ProService.find({ pro: proId }, '_id');
    const serviceIds = proServices.map(s => s._id);

    const filter = { service: { $in: serviceIds } };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      ServiceOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('buyer', 'name email'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({ success: true, data: orders, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/accept
 * Le pro accepte une commande
 */
exports.acceptOrder = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    if (order.status !== 'paid') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas l'acceptation` });
    }

    order.status = 'accepted_by_pro';
    await order.save();

    return res.json({ success: true, data: order, message: 'Commande acceptée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/deliver
 * Le pro marque la commande comme livrée
 */
exports.deliverOrder = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    const allowedStatuses = ['accepted_by_pro', 'in_progress'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas la livraison` });
    }

    const { message, attachments } = req.body || {};
    if (message !== undefined) order.deliveryMessage = String(message).trim() || null;
    if (Array.isArray(attachments) && attachments.length > 0) {
      order.attachments = attachments.map((file) => ({
        name: file.name || '',
        url: file.url || '',
        size: file.size || null,
        mimeType: file.mimeType || '',
      }));
    }

    order.status = 'delivered_by_pro';
    order.deliveredAt = new Date();
    await order.save();

    return res.json({ success: true, data: order, message: 'Livraison signalée, en attente de confirmation acheteur' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/cancellation-request
 * Le pro demande l'annulation d'une commande au buyer
 */
exports.requestCancellation = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    if (['cancelled', 'refunded', 'confirmed_by_buyer', 'litigation_opened'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cette commande ne peut pas être annulée.' });
    }
    if (order.status === 'cancellation_requested') {
      return res.status(409).json({ success: false, message: 'Une demande d\'annulation est déjà en cours.' });
    }

    order.cancellationRequest = {
      reason: String(req.body.reason || '').trim(),
      by: 'pro',
      previousStatus: order.status,
      createdAt: new Date(),
    };
    order.status = 'cancellation_requested';
    order.cancellationRequestedAt = new Date();
    await order.save();

    return res.json({ success: true, data: order, message: 'Demande d\'annulation envoyée au client.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/cancellation/accept
 * Le pro accepte la demande d'annulation du client
 */
exports.acceptCancellationRequest = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    if (order.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas d'accepter une annulation` });
    }

    if (!order.cancellationRequest || order.cancellationRequest.by !== 'buyer') {
      return res.status(400).json({ success: false, message: 'Aucune demande d\'annulation acheteur à traiter' });
    }

    const previousStatus = order.cancellationRequest.previousStatus || 'paid';
    const refundMessage = String(req.body.message || '').trim();

    if (order.stripePaymentIntentId) {
      try {
        if (order.payoutStatus === 'pending') {
          await stripeService.cancelPaymentIntent(order.stripePaymentIntentId);
        } else {
          await stripeService.refundPaymentIntent(order.stripePaymentIntentId);
        }
      } catch (stripeErr) {
        console.error('[Stripe] cancellation accept error:', stripeErr.message);
        return res.status(502).json({ success: false, message: 'Erreur Stripe lors de l\'annulation', error: stripeErr.message });
      }
      order.payoutStatus = 'cancelled';
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancellationResponse = {
      by: 'pro',
      accepted: true,
      message: refundMessage || null,
      createdAt: new Date(),
    };

    await order.save();

    return res.json({ success: true, data: order, message: 'Demande d\'annulation acceptée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/cancellation/reject
 * Le pro refuse la demande d'annulation du client
 */
exports.rejectCancellationRequest = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    if (order.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas de refuser une annulation` });
    }

    if (!order.cancellationRequest || order.cancellationRequest.by !== 'buyer') {
      return res.status(400).json({ success: false, message: 'Aucune demande d\'annulation acheteur à traiter' });
    }

    const previousStatus = order.cancellationRequest.previousStatus || 'paid';
    const responseMessage = String(req.body.message || '').trim();

    order.status = previousStatus;
    order.cancellationResponse = {
      by: 'pro',
      accepted: false,
      message: responseMessage || null,
      createdAt: new Date(),
    };

    await order.save();

    return res.json({ success: true, data: order, message: 'Demande d\'annulation refusée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /pro/marketplace/orders/:id/litigation
 * Le pro ouvre un litige sur une commande
 */
exports.openLitigation = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const service = await ProService.findOne({ _id: order.service, pro: proId });
    if (!service) return res.status(403).json({ success: false, message: 'Non autorisé' });

    const allowedStatuses = ['paid', 'accepted_by_pro', 'in_progress', 'delivered_by_pro'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: `Impossible d'ouvrir un litige sur une commande au statut : ${order.status}` });
    }

    order.status = 'litigation_opened';
    order.litigationOpenedAt = new Date();
    order.litigationDescription = String(req.body.description || '').trim() || null;
    order.litigationInitiatedBy = 'pro';
    await order.save();

    return res.json({ success: true, data: order, message: 'Litige ouvert, un admin va prendre en charge' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /pro/marketplace/reviews
 * Avis reçus par le pro
 */
exports.listProReviews = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceReview } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
      ServiceReview.find({ pro: proId, status: 'published' })
        .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('buyer', 'name avatar')
        .populate('order', 'totalPriceTTC'),
      ServiceReview.countDocuments({ pro: proId, status: 'published' }),
    ]);

    const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

    return res.json({ success: true, data: reviews, avgRating, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /pro/marketplace/dashboard
 * Tableau de bord du pro
 */
exports.getProDashboard = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder, ServiceReview } = getModels(lang);
    const proId = req.identity && req.identity._id;
    if (!proId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const proServices = await ProService.find({ pro: proId, status: { $ne: 'deleted' } }, '_id status');
    const activeServices = proServices.filter(s => s.status === 'active').length;
    const serviceIds = proServices.map(s => s._id);

    const [totalOrders, completedOrders, openOrders, reviews] = await Promise.all([
      ServiceOrder.countDocuments({ service: { $in: serviceIds } }),
      ServiceOrder.find({ service: { $in: serviceIds }, status: { $in: ['confirmed_by_buyer', 'payout_released'] } }),
      ServiceOrder.countDocuments({ service: { $in: serviceIds }, status: { $in: ['paid', 'accepted_by_pro', 'in_progress', 'delivered_by_pro'] } }),
      ServiceReview.find({ pro: proId, status: 'published' }),
    ]);

    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalPriceTTC - o.commissionHT), 0);
    const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

    return res.json({
      success: true,
      data: {
        activeServices,
        totalServices: proServices.length,
        totalOrders,
        openOrders,
        completedOrders: completedOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        reviewCount: reviews.length,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── Stripe Connect : onboarding pro ─────────────────────────────────────────

/**
 * POST /pro/marketplace/stripe/onboard
 * Crée ou récupère le compte Stripe Connect Express du pro
 * et retourne le lien d'onboarding.
 */
exports.stripeOnboard = async (req, res) => {
  try {
    const pro = req.identity;
    if (!pro) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const User = require('mongoose').model('users');
    const proUser = await User.findById(pro._id);
    if (!proUser) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    // Crée le compte Connect si pas encore fait
    if (!proUser.stripeConnectAccountId) {
      const account = await stripeService.createConnectAccount({
        email: proUser.email,
        name: proUser.name || proUser.fullName || proUser.email,
      });
      proUser.stripeConnectAccountId = account.id;
      await proUser.save();
    }

    const frontUrl = process.env.FRONT_WEB_URL || 'http://localhost:3000';
    const link = await stripeService.createOnboardingLink(
      proUser.stripeConnectAccountId,
      `${frontUrl}/pro/stripe/refresh`,
      `${frontUrl}/pro/stripe/success`,
    );

    return res.json({ success: true, url: link.url, accountId: proUser.stripeConnectAccountId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur Stripe Connect', error: err.message });
  }
};

/**
 * GET /pro/marketplace/stripe/status
 * Vérifie si le compte Stripe Connect du pro est actif (charges + payouts enabled)
 */
exports.stripeStatus = async (req, res) => {
  try {
    const pro = req.identity;
    if (!pro) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const User = require('mongoose').model('users');
    const proUser = await User.findById(pro._id);

    if (!proUser || !proUser.stripeConnectAccountId) {
      return res.json({ success: true, data: { connected: false, message: 'Aucun compte Stripe Connect lié' } });
    }

    const status = await stripeService.getConnectAccountStatus(proUser.stripeConnectAccountId);
    return res.json({
      success: true,
      data: {
        connected: status.chargesEnabled && status.payoutsEnabled,
        ...status,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur Stripe Connect', error: err.message });
  }
};
