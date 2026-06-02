const ProServiceEn = require('../models/ProService_en.model');
const ProServiceFr = require('../models/ProService_fr.model');
const ServiceCategoryEn = require('../models/ServiceCategory_en.model');
const ServiceCategoryFr = require('../models/ServiceCategory_fr.model');
const ServiceOrderEn = require('../models/ServiceOrder_en.model');
const ServiceOrderFr = require('../models/ServiceOrder_fr.model');
const ServiceReviewEn = require('../models/ServiceReview_en.model');
const ServiceReviewFr = require('../models/ServiceReview_fr.model');
const ServiceFavorite = require('../models/ServiceFavorite.model');
const FeaturedProAssignment = require('../models/FeaturedProAssignment.model');
const MarketplaceSettings = require('../models/MarketplaceSettings.model');
const stripeService = require('../services/stripeMarketplaceService');
const db = require('../../../models');
const Users = db.users;

function getModels(lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return {
    ProService: l === 'en' ? ProServiceEn : ProServiceFr,
    ServiceCategory: l === 'en' ? ServiceCategoryEn : ServiceCategoryFr,
    ServiceOrder: l === 'en' ? ServiceOrderEn : ServiceOrderFr,
    ServiceReview: l === 'en' ? ServiceReviewEn : ServiceReviewFr,
  };
}

async function getMarketplaceSettingsDoc() {
  let settings = await MarketplaceSettings.findOne();
  if (!settings) {
    settings = await MarketplaceSettings.create({});
  }
  return settings;
}

function settingsResponse(settings) {
  const vatPercent = settings.vatPercent ?? 20;
  const commissionPercentHT = settings.commissionPercent ?? 25;
  const commissionPercentTTC = Math.round(commissionPercentHT * (1 + vatPercent / 100) * 100) / 100;
  return {
    payoutDelayDays: settings.minPayoutDelayDays ?? 3,
    vatPercent,
    commissionPercentHT,
    commissionPercentTTC,
    maxServicesPerPro: settings.maxServicesPerPro ?? 10,
  };
}

exports.getMarketplaceSettings = async (req, res) => {
  try {
    const settings = await getMarketplaceSettingsDoc();
    return res.json({ success: true, data: settingsResponse(settings) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.updateMarketplaceSettings = async (req, res) => {
  try {
    const { payoutDelayDays, vatPercent, commissionPercentHT, commissionPercentTTC, maxServicesPerPro } = req.body;
    const settings = await getMarketplaceSettingsDoc();

    if (payoutDelayDays !== undefined) {
      const parsed = Number(payoutDelayDays);
      if (Number.isNaN(parsed) || parsed < 0) return res.status(400).json({ success: false, message: 'Délai de paiement invalide' });
      settings.minPayoutDelayDays = parsed;
    }

    if (vatPercent !== undefined) {
      const parsed = Number(vatPercent);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return res.status(400).json({ success: false, message: 'Taux de TVA invalide' });
      settings.vatPercent = parsed;
    }

    if (commissionPercentHT !== undefined) {
      const parsed = Number(commissionPercentHT);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return res.status(400).json({ success: false, message: 'Commission HT invalide' });
      settings.commissionPercent = parsed;
    }

    if (commissionPercentTTC !== undefined) {
      const parsed = Number(commissionPercentTTC);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return res.status(400).json({ success: false, message: 'Commission TTC invalide' });
      const vat = vatPercent !== undefined ? Number(vatPercent) : settings.vatPercent;
      const computedHT = Math.round((parsed / (1 + vat / 100)) * 100) / 100;
      settings.commissionPercent = computedHT;
    }

    if (maxServicesPerPro !== undefined) {
      const parsed = Number(maxServicesPerPro);
      if (Number.isNaN(parsed) || parsed < 1) return res.status(400).json({ success: false, message: 'Nombre de services maximum invalide' });
      settings.maxServicesPerPro = parsed;
    }

    await settings.save();
    return res.json({ success: true, data: settingsResponse(settings), message: 'Paramètres marketplace mis à jour' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── SERVICES ────────────────────────────────────────────────────────────────

/**
 * GET /admin/marketplace/services
 * Liste tous les services (tous statuts, tous pros)
 */
exports.listAllServices = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder } = getModels(lang);
    const { status, q, categoryId, proRole, city, sortBy = 'createdAt', order = 'desc', page = 1, limit = 30 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (categoryId) filter.category = categoryId;
    if (city) filter.city = { $regex: new RegExp(city, 'i') };

    if (proRole) {
      const roles = String(proRole).split(',').map((r) => r.trim()).filter(Boolean);
      if (roles.length > 0) {
        const proIds = await Users.find({ role: { $in: roles }, accountType: 'pro', isDeleted: false }).select('_id').lean();
        filter.pro = { $in: proIds.map((u) => u._id) };
      }
    }

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const proIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
          { city: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { summary: { $regex: searchRegex } },
        { city: { $regex: searchRegex } },
        { modality: { $regex: searchRegex } },
      ];

      if (proIds.length > 0) {
        orFilters.push({ pro: { $in: proIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'priceTTC', 'title', 'status', 'city', 'saleCount'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const skip = (Number(page) - 1) * Number(limit);
    const [services, total] = await Promise.all([
      ProService.find(filter).sort(sortField === 'saleCount' ? { createdAt: sortOrder } : { [sortField]: sortOrder }).skip(skip).limit(Number(limit))
        .populate('pro', 'name email role city')
        .populate('category', 'name'),
      ProService.countDocuments(filter),
    ]);

    const serviceIds = services.map((service) => service._id);
    const saleStatuses = ['paid', 'accepted_by_pro', 'in_progress', 'delivered_by_pro', 'confirmed_by_buyer', 'payout_released'];
    const sales = await ServiceOrder.aggregate([
      { $match: { service: { $in: serviceIds }, status: { $in: saleStatuses } } },
      { $group: { _id: '$service', count: { $sum: 1 } } },
    ]);
    const saleCountMap = new Map(sales.map((item) => [String(item._id), item.count]));

    let formatted = services.map((svc) => ({
      ...svc.toObject(),
      saleCount: saleCountMap.get(String(svc._id)) || 0,
    }));

    if (sortField === 'saleCount') {
      formatted.sort((a, b) => (a.saleCount - b.saleCount) * sortOrder);
    }

    return res.json({ success: true, data: formatted, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

function formatCsvValue(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

exports.exportServicesCsv = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const { status, q, sortBy = 'createdAt', order = 'desc' } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const proIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { summary: { $regex: searchRegex } },
        { city: { $regex: searchRegex } },
        { modality: { $regex: searchRegex } },
      ];

      if (proIds.length > 0) {
        orFilters.push({ pro: { $in: proIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'priceTTC', 'title', 'status', 'city'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const services = await ProService.find(filter).sort({ [sortField]: sortOrder })
      .populate('pro', 'name email')
      .populate('category', 'name');

    const header = ['Service ID', 'Titre', 'Statut', 'Prestataire', 'Email prestataire', 'Catégorie', 'Ville', 'Modalité', 'Prix TTC', 'Quantité', 'Créé le', 'Mis à jour le'];
    const rows = services.map((svc) => [
      formatCsvValue(svc._id),
      formatCsvValue(lang === 'fr' ? (svc.title_fr || svc.title) : (svc.title_en || svc.title)),
      formatCsvValue(svc.status),
      formatCsvValue(svc.pro?.name || ''),
      formatCsvValue(svc.pro?.email || ''),
      formatCsvValue(svc.category?.name || ''),
      formatCsvValue(svc.city),
      formatCsvValue(svc.modality),
      formatCsvValue(svc.priceTTC),
      formatCsvValue(svc.quantity || ''),
      formatCsvValue(svc.createdAt ? svc.createdAt.toISOString() : ''),
      formatCsvValue(svc.updatedAt ? svc.updatedAt.toISOString() : ''),
    ]);

    const csvContent = [header.map(formatCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="marketplace-services-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /admin/marketplace/services/:id/validate
 * Valider un service (passage draft → active)
 */
exports.validateService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);

    const service = await ProService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    if (service.status !== 'draft') {
      return res.status(400).json({ success: false, message: `Le service est déjà au statut : ${service.status}` });
    }

    service.status = 'active';
    await service.save();

    return res.json({ success: true, data: service, message: 'Service validé et publié' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /admin/marketplace/services/:id/reject
 * Rejeter un service (draft → inactive)
 */
exports.rejectService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);

    const service = await ProService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    service.status = 'inactive';
    await service.save();

    return res.json({ success: true, data: service, message: 'Service rejeté (inactif)' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * PUT /admin/marketplace/services/:id/featured
 * Mettre en avant / retirer la mise en avant d'un service
 */
exports.setFeaturedService = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);

    const service = await ProService.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: 'Service introuvable' });

    service.isFeatured = req.body.isFeatured !== undefined ? req.body.isFeatured : !service.isFeatured;
    await service.save();

    return res.json({ success: true, data: service, message: `Service ${service.isFeatured ? 'mis en avant' : 'retiré de la mise en avant'}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── CATÉGORIES ───────────────────────────────────────────────────────────────

/**
 * GET /admin/marketplace/categories
 * Liste toutes les catégories
 */
exports.listCategories = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceCategory } = getModels(lang);
    const categories = await ServiceCategory.find({}).populate('parentCategory', 'name').sort({ order: 1, name: 1 });
    return res.json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /admin/marketplace/categories
 * Créer une catégorie
 */
exports.createCategory = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceCategory } = getModels(lang);
    const { name, description, iconUrl, order, group, parentCategory } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis' });
    if (group === 'Service' && !parentCategory) return res.status(400).json({ success: false, message: 'La catégorie de service est requise pour un type de service.' });

    const category = await ServiceCategory.create({
      name,
      description,
      iconUrl,
      group: group || 'Service',
      parentCategory: group === 'Service' ? parentCategory : undefined,
      order: order || 0,
      isActive: true,
    });
    return res.status(201).json({ success: true, data: category, message: 'Catégorie créée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * PUT /admin/marketplace/categories/:id
 * Modifier une catégorie
 */
exports.updateCategory = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceCategory } = getModels(lang);

    if (req.body.group === 'Service' && !req.body.parentCategory) {
      return res.status(400).json({ success: false, message: 'La catégorie de service est requise pour un type de service.' });
    }

    const body = { ...req.body };
    if (req.body.group !== 'Service') {
      body.parentCategory = undefined;
    }

    const category = await ServiceCategory.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable' });

    return res.json({ success: true, data: category, message: 'Catégorie mise à jour' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * DELETE /admin/marketplace/categories/:id
 * Désactiver une catégorie (soft delete via isActive)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceCategory } = getModels(lang);

    const category = await ServiceCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable' });

    return res.json({ success: true, message: 'Catégorie désactivée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── COMMANDES ────────────────────────────────────────────────────────────────

/**
 * GET /admin/marketplace/orders
 * Liste toutes les commandes
 */
exports.listAllOrders = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, q, sortBy = 'createdAt', order = 'desc', page = 1, limit = 30 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'serviceSnapshot.pro.name': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
        orFilters.push({ property_id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'quantity', 'city', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      ServiceOrder.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(Number(limit))
        .populate('buyer', 'name email')
        .populate('service', 'title priceTTC')
        .populate('property_id', 'propertyTitle city zipcode address price surface area images'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({ success: true, data: orders, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/users/:userId/orders
 * Liste les commandes marketplace d'un utilisateur donné.
 */
exports.listUserOrders = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { buyer: userId };

    const [orders, total] = await Promise.all([
      ServiceOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('service', 'title priceTTC imageUrls status')
        .populate('property_id', 'propertyTitle city zipcode address propertyType images'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/users/:userId/favorites
 * Liste les services marketplace sauvegardés d'un utilisateur donné.
 */
exports.listUserFavorites = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService } = getModels(lang);
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId required' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { user: userId };

    const [favoriteDocs, total] = await Promise.all([
      ServiceFavorite.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ServiceFavorite.countDocuments(filter),
    ]);

    const serviceIds = favoriteDocs.map((favorite) => favorite.service).filter(Boolean);
    const services = serviceIds.length
      ? await ProService.find({ _id: { $in: serviceIds } })
        .populate('category', 'name iconUrl name_fr')
        .populate('pro', 'name avatar email city')
      : [];

    const servicesById = services.reduce((acc, service) => {
      acc[String(service._id)] = service;
      return acc;
    }, {});

    const data = favoriteDocs.map((favorite) => ({
      ...favorite,
      service: servicesById[String(favorite.service)] || null,
    }));

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/orders/:id
 * Détail d'une commande
 */
function buildOrderDetailPayload(order) {
  const buyerName = order.buyer ? (order.buyer.name || `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim()) : null;
  const serviceSnapshot = order.serviceSnapshot || {};
  const proSnapshot = order.proSnapshot || {};
  const buyerContact = {
    id: order.buyer?._id ? String(order.buyer._id) : null,
    name: buyerName || '—',
    email: order.buyer?.email || null,
    phone: order.buyer?.phone || null,
  };
  const proContact = {
    id: proSnapshot._id ? String(proSnapshot._id) : null,
    name: proSnapshot.name || '—',
    email: proSnapshot.email || null,
    phone: proSnapshot.phone || null,
    role: proSnapshot.role || '—',
    city: proSnapshot.city || '—',
  };
  const originator = order.litigationInitiatedBy === 'pro'
    ? { type: 'pro', ...proContact }
    : { type: 'buyer', ...buyerContact };
  const counterparty = order.litigationInitiatedBy === 'pro'
    ? { type: 'buyer', ...buyerContact }
    : { type: 'pro', ...proContact };

  const selectedProperty = order.property_id || null;
  const propertyDetails = selectedProperty ? {
    id: selectedProperty._id ? String(selectedProperty._id) : null,
    title: selectedProperty.propertyTitle || selectedProperty.title || selectedProperty.name || '—',
    city: selectedProperty.city || selectedProperty.zipcode || '—',
    zipcode: selectedProperty.zipcode || null,
    address: selectedProperty.address || null,
    price: selectedProperty.price != null ? selectedProperty.price : null,
    surface: selectedProperty.surface || selectedProperty.area || null,
    imageUrls: Array.isArray(selectedProperty.images) ? selectedProperty.images : [],
  } : null;

  return {
    id: String(order._id),
    reference: String(order._id),
    status: order.status,
    totalPriceTTC: order.totalPriceTTC,
    commissionHT: order.commissionHT,
    quantity: order.quantity,
    paidAt: order.paidAt,
    deliveredAt: order.deliveredAt,
    confirmedAt: order.confirmedAt,
    createdAt: order.createdAt,
    deliveryMessage: order.deliveryMessage,
    attachments: order.attachments || [],
    buyer: buyerContact,
    pro: proContact,
    property: propertyDetails,
    propertyId: selectedProperty,
    litigation: {
      description: order.litigationDescription || null,
      initiatedBy: order.litigationInitiatedBy || null,
      openedAt: order.litigationOpenedAt || null,
      originator,
      counterparty,
    },
    serviceSnapshot,
    service: {
      id: order.serviceSnapshot?._id ? String(order.serviceSnapshot._id) : (order.service?._id ? String(order.service._id) : null),
      title: serviceSnapshot.title || order.service?.title || '—',
      priceTTC: serviceSnapshot.priceTTC != null ? serviceSnapshot.priceTTC : order.service?.priceTTC,
      modality: serviceSnapshot.modality || order.service?.modality || '—',
      city: serviceSnapshot.city || order.service?.city || '—',
      category: serviceSnapshot.category?.name || (serviceSnapshot.category ? String(serviceSnapshot.category) : '—'),
      status: serviceSnapshot.status || order.service?.status || '—',
      radiusKm: serviceSnapshot.radiusKm != null ? serviceSnapshot.radiusKm : order.service?.radiusKm,
      quantity: serviceSnapshot.quantity != null ? serviceSnapshot.quantity : order.service?.quantity,
      deliveryTime: serviceSnapshot.delivery_time || serviceSnapshot.deliveryTime || '—',
      description: serviceSnapshot.description || '—',
      summary: serviceSnapshot.summary || '—',
      imageUrls: Array.isArray(serviceSnapshot.imageUrls) ? serviceSnapshot.imageUrls : order.service?.imageUrls || [],
    },
  };
}

exports.getOrderDetail = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);

    const order = await ServiceOrder.findById(req.params.id)
      .populate('buyer', 'name email firstName lastName phone')
      .populate('service', 'title priceTTC modality city quantity delivery_time summary description')
      .populate('property_id', 'propertyTitle title name city zipcode address price surface area images')
      .lean();

    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    return res.json({ success: true, data: buildOrderDetailPayload(order) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.getLitigationDetail = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);

    const order = await ServiceOrder.findById(req.params.id)
      .populate('buyer', 'name email firstName lastName phone')
      .populate('service', 'title priceTTC modality city quantity delivery_time summary description')
      .populate('property_id', 'propertyTitle title name city zipcode address price surface area images')
      .lean();

    if (!order || !order.litigationOpenedAt) {
      return res.status(404).json({ success: false, message: 'Litige introuvable' });
    }

    return res.json({ success: true, data: buildOrderDetailPayload(order) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.exportOrdersCsv = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, q, sortBy = 'createdAt', order = 'desc' } = req.query;

    const filter = {};
    if (status) filter.status = status;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'serviceSnapshot.pro.name': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'quantity', 'city', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const orders = await ServiceOrder.find(filter).sort({ [sortField]: sortOrder })
      .populate('buyer', 'name email')
      .populate('service', 'title priceTTC');

    const header = ['Order ID', 'Service', 'Status', 'Buyer', 'Buyer email', 'Pro', 'Price TTC', 'Quantity', 'Created At', 'Delivered At', 'Confirmed At', 'Litigation At', 'Cancellation Requested At'];
    const rows = orders.map((order) => [
      formatCsvValue(order._id),
      formatCsvValue(order.serviceSnapshot?.title || order.service?.title || ''),
      formatCsvValue(order.status),
      formatCsvValue(order.buyer?.name || ''),
      formatCsvValue(order.buyer?.email || ''),
      formatCsvValue(order.proSnapshot?.name || ''),
      formatCsvValue(order.totalPriceTTC),
      formatCsvValue(order.quantity),
      formatCsvValue(order.createdAt ? order.createdAt.toISOString() : ''),
      formatCsvValue(order.deliveredAt ? order.deliveredAt.toISOString() : ''),
      formatCsvValue(order.confirmedAt ? order.confirmedAt.toISOString() : ''),
      formatCsvValue(order.litigationOpenedAt ? order.litigationOpenedAt.toISOString() : ''),
      formatCsvValue(order.cancellationRequestedAt ? order.cancellationRequestedAt.toISOString() : ''),
    ]);

    const csvContent = [header.map(formatCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="marketplace-orders-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/litigations
 * Liste tous les litiges (client ou pro)
 */
exports.listAllLitigations = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, q, sortBy = 'litigationOpenedAt', order = 'desc', page = 1, limit = 30 } = req.query;

    const filter = { litigationOpenedAt: { $exists: true, $ne: null } };
    if (status) filter.status = status;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'litigationDescription': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'litigationOpenedAt', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'litigationOpenedAt';

    const skip = (Number(page) - 1) * Number(limit);
    const [litigations, total] = await Promise.all([
      ServiceOrder.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(Number(limit))
        .populate('buyer', 'name email')
        .populate('service', 'title priceTTC'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({ success: true, data: litigations, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.exportLitigationsCsv = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, q, sortBy = 'litigationOpenedAt', order = 'desc' } = req.query;

    const filter = { litigationOpenedAt: { $exists: true, $ne: null } };
    if (status) filter.status = status;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'litigationDescription': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'litigationOpenedAt', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'litigationOpenedAt';

    const litigations = await ServiceOrder.find(filter).sort({ [sortField]: sortOrder })
      .populate('buyer', 'name email')
      .populate('service', 'title priceTTC');

    const header = ['Order ID', 'Service', 'Pro', 'Buyer', 'Buyer email', 'Initiated by', 'Litigation description', 'Status', 'Price TTC', 'Created At', 'Litigation opened At', 'Delivered At', 'Confirmed At'];
    const rows = litigations.map((order) => [
      formatCsvValue(order._id),
      formatCsvValue(order.serviceSnapshot?.title || order.service?.title || ''),
      formatCsvValue(order.proSnapshot?.name || ''),
      formatCsvValue(order.buyer?.name || ''),
      formatCsvValue(order.buyer?.email || ''),
      formatCsvValue(order.litigationInitiatedBy),
      formatCsvValue(order.litigationDescription),
      formatCsvValue(order.status),
      formatCsvValue(order.totalPriceTTC),
      formatCsvValue(order.createdAt ? order.createdAt.toISOString() : ''),
      formatCsvValue(order.litigationOpenedAt ? order.litigationOpenedAt.toISOString() : ''),
      formatCsvValue(order.deliveredAt ? order.deliveredAt.toISOString() : ''),
      formatCsvValue(order.confirmedAt ? order.confirmedAt.toISOString() : ''),
    ]);

    const csvContent = [header.map(formatCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="marketplace-litigations-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.listAllCancellations = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, initiatedBy, q, sortBy = 'cancellationRequestedAt', order = 'desc', page = 1, limit = 30 } = req.query;

    const filter = { cancellationRequest: { $exists: true, $ne: null } };
    if (status) filter.status = status;
    if (initiatedBy) filter['cancellationRequest.by'] = initiatedBy;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'cancellationRequest.reason': { $regex: searchRegex } },
        { 'cancellationResponse.message': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'cancellationRequestedAt', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'cancellationRequestedAt';

    const skip = (Number(page) - 1) * Number(limit);
    const [cancellations, total] = await Promise.all([
      ServiceOrder.find(filter).sort({ [sortField]: sortOrder }).skip(skip).limit(Number(limit))
        .populate('buyer', 'name email')
        .populate('service', 'title priceTTC'),
      ServiceOrder.countDocuments(filter),
    ]);

    return res.json({ success: true, data: cancellations, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.exportCancellationsCsv = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { status, initiatedBy, q, sortBy = 'cancellationRequestedAt', order = 'desc' } = req.query;

    const filter = { cancellationRequest: { $exists: true, $ne: null } };
    if (status) filter.status = status;
    if (initiatedBy) filter['cancellationRequest.by'] = initiatedBy;

    if (q) {
      const searchRegex = new RegExp(q, 'i');
      const buyerIds = await Users.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
        ],
      }).select('_id').lean();

      const orFilters = [
        { 'serviceSnapshot.title': { $regex: searchRegex } },
        { 'proSnapshot.name': { $regex: searchRegex } },
        { 'cancellationRequest.reason': { $regex: searchRegex } },
        { 'cancellationResponse.message': { $regex: searchRegex } },
      ];

      if (buyerIds.length > 0) {
        orFilters.push({ buyer: { $in: buyerIds.map((u) => u._id) } });
      }
      if (q.match(/^[0-9a-fA-F]{24}$/)) {
        orFilters.push({ _id: q });
      }

      filter.$or = orFilters;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const allowedSortFields = ['createdAt', 'status', 'totalPriceTTC', 'cancellationRequestedAt', 'serviceSnapshot.title', 'proSnapshot.name'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'cancellationRequestedAt';

    const cancellations = await ServiceOrder.find(filter).sort({ [sortField]: sortOrder })
      .populate('buyer', 'name email')
      .populate('service', 'title priceTTC');

    const header = ['Order ID', 'Service', 'Pro', 'Buyer', 'Buyer email', 'Initiated by', 'Request reason', 'Response accepted', 'Response message', 'Status', 'Price TTC', 'Created At', 'Cancellation requested At', 'Cancelled At'];
    const rows = cancellations.map((order) => [
      formatCsvValue(order._id),
      formatCsvValue(order.serviceSnapshot?.title || order.service?.title || ''),
      formatCsvValue(order.proSnapshot?.name || ''),
      formatCsvValue(order.buyer?.name || ''),
      formatCsvValue(order.buyer?.email || ''),
      formatCsvValue(order.cancellationRequest?.by),
      formatCsvValue(order.cancellationRequest?.reason),
      formatCsvValue(order.cancellationResponse?.accepted === true ? 'yes' : order.cancellationResponse?.accepted === false ? 'no' : ''),
      formatCsvValue(order.cancellationResponse?.message || ''),
      formatCsvValue(order.status),
      formatCsvValue(order.totalPriceTTC),
      formatCsvValue(order.createdAt ? order.createdAt.toISOString() : ''),
      formatCsvValue(order.cancellationRequestedAt ? order.cancellationRequestedAt.toISOString() : ''),
      formatCsvValue(order.cancelledAt ? order.cancelledAt.toISOString() : ''),
    ]);

    const csvContent = [header.map(formatCsvValue).join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="marketplace-cancellations-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * POST /admin/marketplace/orders/:id/resolve-litigation
 * Résoudre un litige : rembourser l'acheteur ou libérer le paiement pro
 */
exports.resolveLitigation = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceOrder } = getModels(lang);
    const { decision } = req.body; // 'refund' | 'release'

    if (!['refund', 'release'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision doit être "refund" ou "release"' });
    }

    const order = await ServiceOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });

    if (order.status !== 'litigation_opened') {
      return res.status(400).json({ success: false, message: 'Cette commande n\'est pas en litige' });
    }

    if (decision === 'refund') {
      // ── Remboursement acheteur via Stripe ────────────────────────────────
      if (order.stripePaymentIntentId) {
        try {
          await stripeService.refundPaymentIntent(order.stripePaymentIntentId);
        } catch (stripeErr) {
          console.error('[Stripe] refundPaymentIntent error:', stripeErr.message);
          return res.status(502).json({ success: false, message: 'Erreur Stripe lors du remboursement', error: stripeErr.message });
        }
      }
      order.status = 'refunded';
      order.refundedAt = new Date();
      order.payoutStatus = 'cancelled';
    } else {
      // ── Capture Stripe : libère les fonds vers le pro ────────────────────
      if (order.stripePaymentIntentId) {
        try {
          const captured = await stripeService.capturePaymentIntent(order.stripePaymentIntentId);
          order.stripePayoutId = captured.id;
        } catch (stripeErr) {
          console.error('[Stripe] capturePaymentIntent error:', stripeErr.message);
          return res.status(502).json({ success: false, message: 'Erreur Stripe lors de la capture', error: stripeErr.message });
        }
      }
      order.status = 'payout_released';
      order.payoutReleasedAt = new Date();
      order.payoutStatus = 'released';
    }

    await order.save();

    return res.json({
      success: true,
      data: order,
      message: decision === 'refund' ? 'Remboursement acheteur effectué' : 'Paiement libéré vers le pro',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── AVIS ─────────────────────────────────────────────────────────────────────

/**
 * GET /admin/marketplace/reviews
 * Liste tous les avis
 */
exports.listAllReviews = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceReview } = getModels(lang);
    const { status, page = 1, limit = 30 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      ServiceReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
        .populate('buyer', 'name email')
        .populate('pro', 'name email'),
      ServiceReview.countDocuments(filter),
    ]);

    return res.json({ success: true, data: reviews, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * DELETE /admin/marketplace/reviews/:id
 * Supprimer (modérer) un avis
 */
exports.deleteReview = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ServiceReview } = getModels(lang);

    const review = await ServiceReview.findByIdAndUpdate(req.params.id, { status: 'draft' }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Avis introuvable' });

    return res.json({ success: true, message: 'Avis masqué (modéré)' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── STATISTIQUES ─────────────────────────────────────────────────────────────

/**
 * GET /admin/marketplace/stats
 * Tableau de bord admin : chiffres globaux
 */
exports.getStats = async (req, res) => {
  try {
    const lang = req.query.lang || 'fr';
    const { ProService, ServiceOrder, ServiceReview, ServiceCategory } = getModels(lang);

    const [
      totalServices, activeServices, pendingServices,
      totalOrders, completedOrders, litigationOrders,
      totalRevenue, totalCategories, totalReviews,
    ] = await Promise.all([
      ProService.countDocuments({}),
      ProService.countDocuments({ status: 'active' }),
      ProService.countDocuments({ status: 'draft' }),
      ServiceOrder.countDocuments({}),
      ServiceOrder.countDocuments({ status: { $in: ['confirmed_by_buyer', 'payout_released'] } }),
      ServiceOrder.countDocuments({ status: 'litigation_opened' }),
      ServiceOrder.aggregate([
        { $match: { status: { $in: ['confirmed_by_buyer', 'payout_released'] } } },
        { $group: { _id: null, total: { $sum: '$commissionHT' } } },
      ]),
      ServiceCategory.countDocuments({ isActive: true }),
      ServiceReview.countDocuments({ status: 'published' }),
    ]);

    const totalCommission = totalRevenue.length ? totalRevenue[0].total : 0;

    return res.json({
      success: true,
      data: {
        services: { total: totalServices, active: activeServices, pending: pendingServices },
        orders: { total: totalOrders, completed: completedOrders, litigation: litigationOrders },
        revenue: { totalCommission: Math.round(totalCommission * 100) / 100 },
        categories: totalCategories,
        reviews: totalReviews,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
