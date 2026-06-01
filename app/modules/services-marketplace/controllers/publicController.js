const mongoose = require('mongoose');
const ProServiceEn = require('../models/ProService_en.model');
const ProServiceFr = require('../models/ProService_fr.model');
const ServiceCategoryEn = require('../models/ServiceCategory_en.model');
const ServiceCategoryFr = require('../models/ServiceCategory_fr.model');
const ServiceOrderEn = require('../models/ServiceOrder_en.model');
const ServiceOrderFr = require('../models/ServiceOrder_fr.model');
const ServiceReviewEn = require('../models/ServiceReview_en.model');
const ServiceReviewFr = require('../models/ServiceReview_fr.model');
const ServiceFavorite = require('../models/ServiceFavorite.model');
const MarketplaceSettings = require('../models/MarketplaceSettings.model');
const stripeService = require('../services/stripeMarketplaceService');
const db = require('../../../models');
const Users = db.users;

async function getMarketplaceSettingsDoc() {
  let settings = await MarketplaceSettings.findOne();
  if (!settings) {
    settings = await MarketplaceSettings.create({});
  }
  return settings;
}

function getPriceWithoutVat(totalTTC, vatPercent) {
  return totalTTC / (1 + vatPercent / 100);
}

function getApplicationFeeCents(totalCents, commissionPercentHT, vatPercent) {
  const totalPriceHTCents = Math.round(totalCents / (1 + vatPercent / 100));
  return Math.round(totalPriceHTCents * (commissionPercentHT / 100));
}

function getMarketplaceSettingsFeeCents(totalCents, settings) {
  return getApplicationFeeCents(totalCents, settings.commissionPercent ?? 25, settings.vatPercent ?? 20);
}

// Sélectionne le bon modèle selon la langue (défaut: fr)
function getModels(lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return {
    ProService: l === 'en' ? ProServiceEn : ProServiceFr,
    ServiceCategory: l === 'en' ? ServiceCategoryEn : ServiceCategoryFr,
    ServiceOrder: l === 'en' ? ServiceOrderEn : ServiceOrderFr,
    ServiceReview: l === 'en' ? ServiceReviewEn : ServiceReviewFr,
  };
}

function getMockServices(lang) {
  const isEn = lang === 'en';
  return [
    {
      _id: 'mock-gp-1',
      providerKey: 'geoffroy-papelier',
      provider: {
        name: 'Geoffroy Papelier',
        role: isEn ? 'Advisor iad' : 'Conseiller iAD',
        city: 'Lille',
        avatar: '/assets/img/avatar/agent1.png',
      },
      category: { _id: 'mock-category-1', name: isEn ? 'Valuation' : 'Estimation', name_fr: 'Estimation', iconUrl: '/icons/estimation.svg' },
      title_fr: 'Estimation',
      title_en: 'Property valuation',
      description: isEn
        ? 'Fast property valuation with local market insights.'
        : 'Estimation rapide de votre bien avec des insights du marché local.',
      summary: isEn ? 'Expert agent, estimation offerte.' : 'Conseiller expert, estimation offerte.',
      price_ttc: 0,
      tarification_type: 'Offert',
      zone_covered: 'Lille +10 KM',
      quantity_label: '1 rapport d’estimation',
      rating: 4.9,
      reviewCount: 25,
      status: 'active',
      isFeatured: true,
    },
    {
      _id: 'mock-gp-2',
      providerKey: 'geoffroy-papelier',
      provider: {
        name: 'Geoffroy Papelier',
        role: isEn ? 'Advisor iad' : 'Conseiller iAD',
        city: 'Lille',
        avatar: '/assets/img/avatar/agent1.png',
      },
      category: { _id: 'mock-category-2', name: isEn ? 'Visits' : 'Visites', name_fr: 'Visites', iconUrl: '/icons/visite.svg' },
      title_fr: 'Visites',
      title_en: 'Property visits',
      description: isEn ? 'Accompanied visits for qualified buyers.' : 'Visites accompagnées pour acheteurs qualifiés.',
      summary: isEn ? 'Pack of 10 visits with feedback.' : 'Pack de 10 visites avec compte-rendu.',
      price_ttc: 300,
      tarification_type: 'Forfait',
      zone_covered: 'Lille +10 KM',
      quantity_label: 'Pack 10 visites',
      rating: 4.9,
      reviewCount: 18,
      status: 'active',
      isFeatured: false,
    },
    {
      _id: 'mock-mf-1',
      providerKey: 'michael-fournet',
      provider: {
        name: 'Michaël Fournet',
        role: isEn ? 'Advisor iad' : 'Conseiller iad',
        city: 'Lille',
        avatar: '/assets/img/avatar/agent2.png',
      },
      category: { _id: 'mock-category-3', name: isEn ? 'Negotiation' : 'Négociation', name_fr: 'Négociation', iconUrl: '/icons/negociation.svg' },
      title_fr: 'Négociation',
      title_en: 'Negotiation',
      description: isEn ? 'Strong negotiation support to maximize your sale price.' : 'Accompagnement à la négociation pour maximiser votre prix de vente.',
      summary: isEn ? 'Negotiation support from an experienced agent.' : 'Accompagnement négociation par un agent expérimenté.',
      price_ttc: 0,
      tarification_type: 'Offert',
      zone_covered: 'Métropole lilloise',
      quantity_label: '1 mandat de négociation',
      rating: 4.9,
      reviewCount: 30,
      status: 'active',
      isFeatured: true,
    },
    {
      _id: 'mock-pd-1',
      providerKey: 'pauline-dupont',
      provider: {
        name: 'Pauline Dupont',
        role: isEn ? 'Independent advisor iad' : 'Agent indépendant IAD',
        city: 'Lille',
        avatar: '/assets/img/avatar/agent3.png',
      },
      category: { _id: 'mock-category-4', name: isEn ? 'Seller file' : 'Dossier vendeur', name_fr: 'Dossier vendeur', iconUrl: '/icons/dossier.svg' },
      title_fr: 'Dossier vendeur',
      title_en: 'Seller file preparation',
      description: isEn ? 'Complete seller file for a fast and compliant sale.' : 'Dossier vendeur complet pour une vente rapide et conforme.',
      summary: isEn ? 'Seller file preparation with expert support.' : 'Préparation du dossier vendeur avec support expert.',
      price_ttc: 80,
      tarification_type: 'Forfait',
      zone_covered: 'Lille +5 KM',
      quantity_label: '1 dossier complet',
      rating: 5,
      reviewCount: 8,
      status: 'active',
      isFeatured: false,
    },
  ];
}

function getMockOrders(lang) {
  const isEn = lang === 'en';
  return [
    {
      _id: 'ord-001',
      orderNumber: 'CMD-20260412-001',
      createdAt: '2026-04-12T10:30:00Z',
      service: { title_fr: 'Estimation immobilière de votre bien', title_en: 'Property valuation', price_ttc: 0, imageUrls: [] },
      property: { title: 'Appartement T3 — 12 rue de Béthune, Lille' },
      provider: { name: 'Geoffroy Papelier', city: 'Lille' },
      quantity: 1,
      totalAmount: 0,
      status: 'confirmed_by_buyer',
      payment_status: 'paid',
      deliveredAt: '2026-04-18T14:00:00Z',
      is_booking: true,
    },
    {
      _id: 'ord-002',
      orderNumber: 'CMD-20260420-002',
      createdAt: '2026-04-20T09:15:00Z',
      service: { title_fr: 'Séance photo professionnelle', title_en: 'Professional photo shoot', price_ttc: 120, imageUrls: [] },
      property: { title: 'Appartement T3 — 12 rue de Béthune, Lille' },
      provider: { name: 'Geoffroy Papelier', city: 'Lille' },
      quantity: 1,
      totalAmount: 120,
      status: 'delivered_by_pro',
      payment_status: 'pending',
      deliveredAt: '2026-04-25T11:00:00Z',
    },
    {
      _id: 'ord-003',
      orderNumber: 'CMD-20260428-003',
      createdAt: '2026-04-28T16:45:00Z',
      service: { title_fr: 'Rédaction & diffusion d’annonce', title_en: 'Listing writing & distribution', price_ttc: 50, imageUrls: [] },
      property: { title: 'Maison T5 — 45 av. de la République, Marcq-en-Barœul' },
      provider: { name: 'Michaël Fournet', city: 'Lille' },
      quantity: 1,
      totalAmount: 50,
      status: 'accepted_by_pro',
      payment_status: 'paid',
      deliveredAt: null,
    },
    {
      _id: 'ord-004',
      orderNumber: 'CMD-20260502-004',
      createdAt: '2026-05-02T12:00:00Z',
      service: { title_fr: 'Organisation et conduite des visites', title_en: 'Visit scheduling & hosting', price_ttc: 300, imageUrls: [] },
      property: { title: 'Maison T5 — 45 av. de la République, Marcq-en-Barœul' },
      provider: { name: 'Michaël Fournet', city: 'Lille' },
      quantity: 1,
      totalAmount: 300,
      status: 'paid',
      payment_status: 'paid',
      deliveredAt: null,
    },
    {
      _id: 'ord-005',
      orderNumber: 'CMD-20260505-005',
      createdAt: '2026-05-05T08:30:00Z',
      service: { title_fr: 'Mise en vente complète avec suivi', title_en: 'Full sale management', price_ttc: 1500, imageUrls: [] },
      property: { title: 'Studio — 8 rue Nationale, Lille' },
      provider: { name: 'Geoffroy Papelier', city: 'Lille' },
      quantity: 1,
      totalAmount: 1500,
      status: 'cancelled',
      payment_status: 'refunded',
      deliveredAt: null,
    },
  ];
}

const hasCompleteFeaturedProfile = (pro) => {
  if (!pro) return false;
  return Boolean(
    pro.featuredSubheading &&
    pro.featuredTitle &&
    pro.featuredBio &&
    Number(pro.featuredExperienceYears) > 0 &&
    Number(pro.featuredClientsAccompanied) > 0 &&
    pro.featuredRatingNotes &&
    pro.featuredSatisfactionRate &&
    pro.featuredProfilePhoto
  );
};

const buildFeaturedProPayload = (pro) => {
  const fullName = pro.fullName || `${pro.firstName || ''} ${pro.lastName || ''}`.trim();
  return {
    id: pro._id,
    fullName,
    firstName: pro.firstName,
    lastName: pro.lastName,
    tag: pro.featuredSubheading,
    headline: pro.featuredTitle,
    description: pro.featuredBio,
    photo: pro.featuredProfilePhoto || pro.image || pro.avatar,
    phone: pro.mobileNo || pro.phone,
    isTopAgent: pro.isTopAgent,
    isGlobalFavorite: pro.isGlobalFavorite,
    isLocalFavorite: pro.isLocalFavorite,
    localFavoritePostalCodes: pro.localFavoritePostalCodes || [],
    stats: [
      { value: String(pro.featuredExperienceYears || 0), label: "Années d'expérience" },
      { value: String(pro.featuredClientsAccompanied || 0), label: "Clients accompagnés" },
      { value: String(pro.featuredRatingNotes || "-"), label: "Notes" },
      { value: String(pro.featuredSatisfactionRate || "-"), label: "Clients satisfaits" },
    ],
  };
};

const buildMockFavoritePayload = (service, index) => ({
  _id: `mock-favorite-${index + 1}`,
  service,
  createdAt: new Date(),
});

/**
 * GET /marketplace/favorite-pros
 * Liste des pros favoris complets pour l'encart Featured agents
 */
exports.listFavoritePros = async (req, res) => {
  try {
    const postalCode = req.query.postalCode || null;
    const filter = { accountType: 'pro', isDeleted: false, status: 'active' };
    const pros = await Users.find(filter).select(
      'firstName lastName fullName phone mobileNo image avatar accountType status isGlobalFavorite isLocalFavorite isTopAgent localFavoritePostalCodes featuredSubheading featuredTitle featuredBio featuredExperienceYears featuredClientsAccompanied featuredRatingNotes featuredSatisfactionRate featuredProfilePhoto'
    );

    const favorites = pros
      .filter((pro) => (pro.isGlobalFavorite || pro.isLocalFavorite) && hasCompleteFeaturedProfile(pro))
      .map(buildFeaturedProPayload);

    const globalFavorites = favorites.filter((pro) => pro.isGlobalFavorite).slice(0, 2);
    const localFavorites = postalCode
      ? favorites.filter((pro) => pro.isLocalFavorite && pro.localFavoritePostalCodes.includes(postalCode)).slice(0, 2)
      : favorites.filter((pro) => pro.isLocalFavorite).slice(0, 2);

    return res.json({
      success: true,
      data: {
        globalFavorites,
        localFavorites,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/services
 * Liste les services actifs avec filtres (catégorie, ville, prix, recherche)
 */
exports.listServices = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const {
      category, city, location, provider, minPrice, maxPrice, search,
      page = 1, limit = 20, sortBy = 'createdAt', order = 'desc'
    } = req.query;

    const filter = { status: 'active' };
    if (category) filter.category = category;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (location) filter.city = { $regex: location, $options: 'i' };
    if (provider) {
      if (mongoose.Types.ObjectId.isValid(provider)) {
        filter.pro = provider;
      } else {
        const match = await Users.findOne({
          $or: [
            { fullName: provider },
            { username: provider },
            { email: provider },
          ],
        }).select('_id');
        if (match) {
          filter.pro = match._id;
        } else {
          filter.pro = null;
        }
      }
    }
    if (minPrice || maxPrice) {
      filter.priceTTC = {};
      if (minPrice) filter.priceTTC.$gte = Number(minPrice);
      if (maxPrice) filter.priceTTC.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [services, total] = await Promise.all([
      ProService.find(filter)
        .sort({ isFeatured: -1, [sortBy]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .populate('category', 'name iconUrl')
        .populate('pro', 'name avatar accountType isGlobalFavorite isLocalFavorite isTopAgent featuredSubheading featuredTitle featuredBio featuredExperienceYears featuredClientsAccompanied featuredRatingNotes featuredSatisfactionRate featuredProfilePhoto'),
      ProService.countDocuments(filter),
    ]);

    if ((services.length === 0 || total === 0) && (req.isGuest || req.query.guest === 'true' || req.headers['x-guest-mode'] === 'true' || req.headers['x-guest-mode'] === '1')) {
      const mockServices = getMockServices(lang);
      return res.json({
        success: true,
        data: mockServices,
        pagination: { page: 1, limit: mockServices.length, total: mockServices.length, pages: 1 },
      });
    }

    return res.json({
      success: true,
      data: services,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/services/:id
 * Détail d'un service avec avis et pro
 */
exports.getServiceDetail = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceReview } = getModels(lang);
    const isGuestRequest = req.isGuest || req.query.guest === 'true' || req.headers['x-guest-mode'] === 'true' || req.headers['x-guest-mode'] === '1';

    let service = await ProService.findOne({ _id: req.params.id, status: 'active' })
      .populate('category', 'name iconUrl')
      .populate('pro', 'name avatar email');

    if (!service && isGuestRequest) {
      const mockServices = getMockServices(lang);
      service = mockServices.find((svc) => svc._id === req.params.id) || null;
    }

    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    if (typeof service.toObject !== 'function') {
      return res.json({
        success: true,
        data: {
          ...service,
          reviews: [],
          avgRating: service.rating ?? null,
        },
      });
    }

    const reviewDocs = await ServiceReview.find({ pro: service.pro, status: 'published' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('buyer', 'name avatar');
    const avgRating = reviewDocs.length ? reviewDocs.reduce((sum, r) => sum + r.rating, 0) / reviewDocs.length : null;

    return res.json({ success: true, data: { ...service.toObject(), reviews: reviewDocs, avgRating } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/categories
 * Liste les catégories actives
 */
exports.listCategories = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceCategory } = getModels(lang);
    const categories = await ServiceCategory.find({ isActive: true }).sort({ order: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders
 * Créer une commande + PaymentIntent Stripe (escrow, capture manuelle)
 * Retourne le client_secret pour que le front finalise le paiement.
 */
exports.createOrder = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    const buyerEmail = req.identity && req.identity.email;

    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const serviceId = req.body.serviceId || req.body.service_id;
    const propertyId = req.body.propertyId || req.body.property_id || null;
    const { quantity } = req.body;

    const service = await ProService.findOne({ _id: serviceId, status: 'active' })
      .populate('pro', 'name email stripeConnectAccountId');
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable ou inactif' });

    if (String(service.pro._id) === String(buyerId)) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas commander votre propre service' });
    }

    if (quantity > service.quantity) {
      return res.status(400).json({ success: false, message: `Quantité max disponible : ${service.quantity}` });
    }

    const settings = await getMarketplaceSettingsDoc();
    const totalPriceTTC = service.priceTTC * quantity;
    const vatPercent = settings.vatPercent ?? 20;
    const commissionPercentHT = settings.commissionPercent ?? 25;
    const totalPriceHT = Math.round((totalPriceTTC / (1 + vatPercent / 100)) * 100) / 100;
    const vatAmount = Math.round((totalPriceTTC - totalPriceHT) * 100) / 100;
    const commissionHT = Math.round((totalPriceHT * commissionPercentHT) / 100 * 100) / 100;
    const platformAmount = Math.round((commissionHT + vatAmount) * 100) / 100;
    const proAmount = Math.round((totalPriceHT - commissionHT) * 100) / 100;
    const feeAmountCents = Math.round(platformAmount * 100);

    // ── Créer la commande en base (statut pending_payment) ──────────────────
    const order = await ServiceOrder.create({
      serviceSnapshot: service.toObject(),
      proSnapshot: service.pro.toObject ? service.pro.toObject() : service.pro,
      buyer: buyerId,
      service: service._id,
      property_id: propertyId,
      quantity,
      totalPriceTTC,
      totalPriceHT,
      vatAmount,
      commissionHT,
      platformAmount,
      proAmount,
      status: 'pending_payment',
    });

    // ── Créer le PaymentIntent Stripe (escrow) ──────────────────────────────
    let stripeData = null;
    if (process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY) {
      try {
        const paymentIntent = await stripeService.createPaymentIntent({
          amountTTC: totalPriceTTC,
          stripeAccountId: service.pro.stripeConnectAccountId || null,
          orderId: order._id,
          buyerEmail,
          serviceTitle: service.title,
          feeAmountCents,
        });

        // Sauvegarder le paymentIntentId sur la commande
        order.stripePaymentIntentId = paymentIntent.id;
        await order.save();

        stripeData = { clientSecret: paymentIntent.client_secret };
      } catch (stripeErr) {
        // Stripe non configuré ou erreur : on retourne quand même la commande
        // Le paiement pourra être recréé via un endpoint dédié
        console.error('[Stripe] createPaymentIntent error:', stripeErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      data: order,
      stripe: stripeData,
      message: stripeData
        ? 'Commande créée, finalisez le paiement avec le client_secret fourni'
        : 'Commande créée (Stripe non configuré - contactez l\'administrateur)',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/orders
 * Liste les commandes de l'acheteur connecté
 */
exports.listOrders = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const isGuestRequest = req.isGuest || req.query.guest === 'true' || req.headers['x-guest-mode'] === 'true' || req.headers['x-guest-mode'] === '1';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    if (isGuestRequest) {
      const mockData = getMockOrders(lang);
      return res.json({
        success: true,
        data: mockData,
        pagination: {
          page,
          limit: mockData.length,
          total: mockData.length,
          totalPages: 1,
        },
      });
    }

    const buyerId = req.identity && req.identity._id;
    if (!buyerId) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const filter = { buyer: buyerId };
    const [items, total] = await Promise.all([
      ServiceOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('service', 'title priceTTC imageUrls'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders/:id/pay
 * (Re)crée un PaymentIntent pour une commande pending_payment
 * Utile si le premier createOrder a échoué ou si l'intent a expiré.
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId })
      .populate({ path: 'service', populate: { path: 'pro', select: 'name email stripeConnectAccountId' } });

    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: `La commande est déjà au statut : ${order.status}` });
    }

    const feeAmountCents = Math.round((order.platformAmount ?? 0) * 100);
    const paymentIntent = await stripeService.createPaymentIntent({
      amountTTC: order.totalPriceTTC,
      stripeAccountId: order.serviceSnapshot.pro && order.serviceSnapshot.pro.stripeConnectAccountId,
      orderId: order._id,
      buyerEmail: req.identity.email,
      serviceTitle: order.serviceSnapshot.title,
      feeAmountCents,
    });

    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    return res.json({ success: true, stripe: { clientSecret: paymentIntent.client_secret } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/orders/:id
 * Détail d'une commande (acheteur uniquement)
 */
exports.getOrderDetail = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId })
      .populate('service', 'title priceTTC imageUrls');

    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders/:id/confirm
 * L'acheteur confirme la livraison → capture Stripe (paiement libéré vers pro)
 */
exports.confirmOrderDelivery = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (order.status !== 'delivered_by_pro') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas la confirmation` });
    }

    // ── Capture Stripe : libère les fonds vers le pro ───────────────────────
    if (order.stripePaymentIntentId) {
      try {
        const captured = await stripeService.capturePaymentIntent(order.stripePaymentIntentId);
        order.stripePayoutId = captured.id; // l'intent capturé sert de référence payout
      } catch (stripeErr) {
        console.error('[Stripe] capturePaymentIntent error:', stripeErr.message);
        // On continue : le statut est mis à jour, l'admin peut capturer manuellement
      }
    }

    order.status = 'confirmed_by_buyer';
    order.confirmedAt = new Date();
    order.payoutStatus = 'released';
    order.payoutReleasedAt = new Date();
    await order.save();

    return res.json({ success: true, data: order, message: 'Livraison confirmée, paiement pro libéré' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders/:id/cancellation-request
 * L'acheteur demande l'annulation d'une commande
 */
exports.requestCancellation = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    if (['cancelled', 'refunded', 'confirmed_by_buyer', 'litigation_opened'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cette commande ne peut pas être annulée.' });
    }
    if (order.status === 'cancellation_requested') {
      return res.status(409).json({ success: false, message: 'Une demande d\'annulation est déjà en cours.' });
    }

    order.cancellationRequest = {
      reason: String(req.body.reason || '').trim(),
      by: 'buyer',
      previousStatus: order.status,
      createdAt: new Date(),
    };
    order.status = 'cancellation_requested';
    order.cancellationRequestedAt = new Date();
    await order.save();

    return res.json({ success: true, data: order, message: 'Demande d\'annulation envoyée.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders/:id/cancellation/accept
 * L'acheteur accepte une demande d'annulation émise par le pro
 */
exports.acceptCancellationRequest = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (order.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas d'accepter une annulation` });
    }
    if (!order.cancellationRequest || order.cancellationRequest.by !== 'pro') {
      return res.status(400).json({ success: false, message: 'Aucune demande d\'annulation pro à traiter' });
    }

    const responseMessage = String(req.body.message || '').trim();

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
      by: 'buyer',
      accepted: true,
      message: responseMessage || null,
      createdAt: new Date(),
    };

    await order.save();

    return res.json({ success: true, data: order, message: 'Demande d\'annulation acceptée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/orders/:id/cancellation/reject
 * L'acheteur refuse une demande d'annulation émise par le pro
 */
exports.rejectCancellationRequest = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (order.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: `Statut actuel (${order.status}) ne permet pas de refuser une annulation` });
    }
    if (!order.cancellationRequest || order.cancellationRequest.by !== 'pro') {
      return res.status(400).json({ success: false, message: 'Aucune demande d\'annulation pro à traiter' });
    }

    const previousStatus = order.cancellationRequest.previousStatus || 'paid';
    const responseMessage = String(req.body.message || '').trim();

    order.status = previousStatus;
    order.cancellationResponse = {
      by: 'buyer',
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
 * POST /marketplace/orders/:id/litigation
 * L'acheteur ouvre un litige
 */
exports.openLitigation = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const order = await ServiceOrder.findOne({ _id: req.params.id, buyer: buyerId });
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    const allowedStatuses = ['paid', 'accepted_by_pro', 'in_progress', 'delivered_by_pro'];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({ success: false, message: `Impossible d'ouvrir un litige sur une commande au statut : ${order.status}` });
    }

    const { description } = req.body;
    order.status = 'litigation_opened';
    order.litigationOpenedAt = new Date();
    order.litigationDescription = String(description || '').trim() || null;
    order.litigationInitiatedBy = 'buyer';
    await order.save();

    return res.json({ success: true, data: order, message: 'Litige ouvert, un admin va prendre en charge' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/reviews
 * Soumettre un avis après commande confirmée
 */
exports.createReview = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder, ServiceReview } = getModels(lang);
    const buyerId = req.identity && req.identity._id;
    if (!buyerId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { orderId, rating, comment, recommend } = req.body;
    if (!orderId || !rating) {
      return res.status(400).json({ success: false, message: 'orderId et rating requis' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'La note doit être entre 1 et 5' });
    }

    const order = await ServiceOrder.findOne({ _id: orderId, buyer: buyerId, status: 'confirmed_by_buyer' });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable ou non confirmée' });
    }

    const existing = await ServiceReview.findOne({ order: orderId });
    if (existing) return res.status(409).json({ success: false, message: 'Avis déjà soumis pour cette commande' });

    const review = await ServiceReview.create({
      order: orderId,
      pro: order.proSnapshot._id || order.proSnapshot.id,
      buyer: buyerId,
      rating,
      comment,
      recommend: recommend || false,
      status: 'published',
    });

    return res.status(201).json({ success: true, data: review, message: 'Avis publié' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /marketplace/favorites/:serviceId
 * Ajouter/retirer un service des favoris
 */
exports.toggleFavorite = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const { serviceId } = req.params;
    const existing = await ServiceFavorite.findOne({ user: userId, service: serviceId });

    if (existing) {
      await ServiceFavorite.deleteOne({ _id: existing._id });
      return res.json({ success: true, message: 'Retiré des favoris', favorited: false });
    }

    const fav = await ServiceFavorite.create({ user: userId, service: serviceId, status: 'active' });
    return res.status(201).json({ success: true, data: fav, message: 'Ajouté aux favoris', favorited: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/favorites
 * Liste les favoris de l'utilisateur connecté
 */
exports.listFavorites = async (req, res) => {
  try {
    const isGuestRequest = req.isGuest || req.query.guest === 'true' || req.headers['x-guest-mode'] === 'true' || req.headers['x-guest-mode'] === '1';
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const userId = req.identity && req.identity._id;

    if (isGuestRequest && req.isGuest) {
      const mockServices = getMockServices(lang);
      const favorites = mockServices.slice(0, 2);
      return res.json({ success: true, isMock: true, data: favorites });
    }

    if (!userId) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const favoritesDocs = await ServiceFavorite.find({ user: userId }).sort({ createdAt: -1 });
    const serviceIds = favoritesDocs.map((fav) => fav.service).filter(Boolean);
    if (!serviceIds.length) {
      return res.json({ success: true, data: [] });
    }

    const services = await ProService.find({ _id: { $in: serviceIds }, status: 'active' })
      .populate('category', 'name iconUrl name_fr')
      .populate('pro', 'name avatar email');

    const servicesById = services.reduce((acc, svc) => {
      acc[svc._id.toString()] = svc;
      return acc;
    }, {});

    const orderedServices = serviceIds
      .map((serviceId) => servicesById[serviceId.toString()])
      .filter(Boolean);

    return res.json({ success: true, data: orderedServices });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
