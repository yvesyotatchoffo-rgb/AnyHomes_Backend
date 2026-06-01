const mongoose = require('mongoose');
const ProServiceEn = require('../models/ProService_en.model');
const ProServiceFr = require('../models/ProService_fr.model');
const ServiceCategoryEn = require('../models/ServiceCategory_en.model');
const ServiceCategoryFr = require('../models/ServiceCategory_fr.model');
const ServiceOrderEn = require('../models/ServiceOrder_en.model');
const ServiceOrderFr = require('../models/ServiceOrder_fr.model');
const ServiceReviewEn = require('../models/ServiceReview_en.model');
const ServiceReviewFr = require('../models/ServiceReview_fr.model');
const db = require('../../../models');

const Users = db.users;
const Property = db.property;

const PARTNER_ROLES = ['agency', 'agent', 'hunter'];
const REVENUE_STATUSES = ['paid', 'confirmed_by_buyer', 'payout_released'];
const ACTIVE_ORDER_STATUSES = [
  'paid', 'accepted_by_pro', 'in_progress', 'delivered_by_pro',
  'cancellation_requested', 'confirmed_by_buyer', 'litigation_opened', 'payout_released'
];
const USER_FRONTEND_URL = process.env.USER_FRONTEND_URL || 'http://localhost:8089';

function getModels(lang) {
  const l = lang === 'en' ? 'en' : 'fr';
  return {
    ProService: l === 'en' ? ProServiceEn : ProServiceFr,
    ServiceCategory: l === 'en' ? ServiceCategoryEn : ServiceCategoryFr,
    ServiceOrder: l === 'en' ? ServiceOrderEn : ServiceOrderFr,
    ServiceReview: l === 'en' ? ServiceReviewEn : ServiceReviewFr,
  };
}

function csvToArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

function computeInitials(user) {
  const first = (user.firstName || '').trim();
  const last = (user.lastName || '').trim();
  if (first || last) {
    return ((first[0] || '') + (last[0] || '')).toUpperCase();
  }
  const full = (user.fullName || user.email || '').trim();
  if (!full) return '?';
  const parts = full.split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || '').toUpperCase()).join('') || '?';
}

function pickAvatar(user) {
  return user.featuredProfilePhoto || user.image || null;
}

function statusMatches(partnerStatusFilter, user) {
  if (!partnerStatusFilter || partnerStatusFilter.length === 0) return true;
  const wanted = new Set(partnerStatusFilter);
  if (wanted.has('global') && user.isGlobalFavorite) return true;
  if (wanted.has('local') && user.isLocalFavorite) return true;
  if (wanted.has('top') && user.isTopAgent) return true;
  return false;
}

// ─── LISTE PARTENAIRES (niveau 1) ─────────────────────────────────────────
exports.listPartners = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const { ProService, ServiceOrder } = getModels(lang);

    const {
      search,
      role,
      partnerStatus,
      city,
      categoryId,
      hasService,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      count = 10,
    } = req.query;

    const userFilter = {
      isDeleted: false,
      accountType: 'pro',
      role: { $in: PARTNER_ROLES },
    };

    const roleList = csvToArray(role).filter((r) => PARTNER_ROLES.includes(r));
    if (roleList.length > 0) userFilter.role = { $in: roleList };

    if (city) userFilter.city = { $regex: `^${city}$`, $options: 'i' };

    if (search) {
      const rx = new RegExp(search, 'i');
      userFilter.$or = [
        { fullName: rx },
        { firstName: rx },
        { lastName: rx },
        { companyName: rx },
        { email: rx },
        { city: rx },
      ];
    }

    // Limiter aux pros avec ≥1 service de la catégorie donnée
    let restrictToProIds = null;
    const categoryObjectId = toObjectId(categoryId);
    if (categoryObjectId) {
      const proIds = await ProService.distinct('pro', {
        category: categoryObjectId,
        status: { $ne: 'deleted' },
      });
      restrictToProIds = proIds.map(String);
    }

    // Limiter aux pros avec ≥1 service quel qu'il soit
    if (String(hasService) === 'true') {
      const proIds = await ProService.distinct('pro', {
        status: { $ne: 'deleted' },
      });
      const stringIds = proIds.map(String);
      restrictToProIds = restrictToProIds
        ? restrictToProIds.filter((id) => stringIds.includes(id))
        : stringIds;
    }

    if (restrictToProIds) {
      if (restrictToProIds.length === 0) {
        return res.json({ success: true, total: 0, page: Number(page), count: Number(count), data: [] });
      }
      userFilter._id = { $in: restrictToProIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    const partnerStatusList = csvToArray(partnerStatus)
      .map((s) => s.toLowerCase())
      .filter((s) => ['global', 'local', 'top'].includes(s));

    // tri serveur sur champs Users uniquement ; serviceCount/revenueTTC triés après calcul
    const SORTABLE_USER_FIELDS = ['fullName', 'role', 'city', 'createdAt'];
    const sortField = SORTABLE_USER_FIELDS.includes(sortBy) ? sortBy : null;
    const sortDir = order === 'asc' ? 1 : -1;

    const isAggregatedSort = ['serviceCount', 'revenueTTC'].includes(sortBy);

    let users;
    let total;

    if (isAggregatedSort || partnerStatusList.length > 0) {
      // On charge tout (filtré) puis on calcule, filtre par statut, trie, pagine.
      users = await Users.find(userFilter).select(
        'firstName lastName fullName companyName email image city role createdAt mobileNo ' +
        'isGlobalFavorite isLocalFavorite isTopAgent localFavoritePostalCodes partnerAssignedAt ' +
        'featuredProfilePhoto'
      ).lean();
    } else {
      total = await Users.countDocuments(userFilter);
      const query = Users.find(userFilter).select(
        'firstName lastName fullName companyName email image city role createdAt mobileNo ' +
        'isGlobalFavorite isLocalFavorite isTopAgent localFavoritePostalCodes partnerAssignedAt ' +
        'featuredProfilePhoto'
      ).lean();
      if (sortField) query.sort({ [sortField]: sortDir });
      query.skip((Number(page) - 1) * Number(count)).limit(Number(count));
      users = await query;
    }

    if (users.length === 0) {
      return res.json({ success: true, total: total ?? 0, page: Number(page), count: Number(count), data: [] });
    }

    // Calcul services + CA en deux agrégations groupées
    const userIds = users.map((u) => u._id);

    const [serviceCounts, revenueAgg] = await Promise.all([
      ProService.aggregate([
        { $match: { pro: { $in: userIds }, status: { $ne: 'deleted' } } },
        { $group: { _id: '$pro', count: { $sum: 1 } } },
      ]),
      ServiceOrder.aggregate([
        { $match: { status: { $in: REVENUE_STATUSES } } },
        {
          $lookup: {
            from: ProService.collection.name,
            localField: 'service',
            foreignField: '_id',
            as: 'svc',
          },
        },
        { $unwind: '$svc' },
        { $match: { 'svc.pro': { $in: userIds } } },
        { $group: { _id: '$svc.pro', revenueTTC: { $sum: '$totalPriceTTC' } } },
      ]),
    ]);

    const countMap = new Map(serviceCounts.map((r) => [String(r._id), r.count]));
    const revenueMap = new Map(revenueAgg.map((r) => [String(r._id), r.revenueTTC]));

    let enriched = users.map((u) => ({
      id: String(u._id),
      fullName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || null,
      companyName: u.companyName || null,
      email: u.email || null,
      mobileNo: u.mobileNo || null,
      image: pickAvatar(u),
      initials: computeInitials(u),
      role: u.role,
      city: u.city || null,
      createdAt: u.createdAt,
      isGlobalFavorite: !!u.isGlobalFavorite,
      isLocalFavorite: !!u.isLocalFavorite,
      isTopAgent: !!u.isTopAgent,
      localFavoritePostalCodes: u.localFavoritePostalCodes || [],
      partnerAssignedAt: u.partnerAssignedAt || null,
      serviceCount: countMap.get(String(u._id)) || 0,
      revenueTTC: Math.round((revenueMap.get(String(u._id)) || 0) * 100) / 100,
    }));

    if (partnerStatusList.length > 0) {
      enriched = enriched.filter((u) => statusMatches(partnerStatusList, u));
    }

    if (isAggregatedSort || partnerStatusList.length > 0) {
      // Tri
      if (isAggregatedSort) {
        enriched.sort((a, b) => (a[sortBy] - b[sortBy]) * sortDir);
      } else if (sortField) {
        enriched.sort((a, b) => {
          const av = a[sortField] ?? '';
          const bv = b[sortField] ?? '';
          if (av < bv) return -1 * sortDir;
          if (av > bv) return 1 * sortDir;
          return 0;
        });
      } else {
        enriched.sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)));
      }
      total = enriched.length;
      const start = (Number(page) - 1) * Number(count);
      enriched = enriched.slice(start, start + Number(count));
    }

    return res.json({
      success: true,
      total: total ?? enriched.length,
      page: Number(page),
      count: Number(count),
      data: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── DÉTAIL PARTENAIRE (header niveau 2) ──────────────────────────────────
exports.getPartnerDetail = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const { ProService, ServiceOrder, ServiceReview } = getModels(lang);

    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const user = await Users.findOne({ _id: userId, isDeleted: false }).lean();
    if (!user) return res.status(404).json({ success: false, message: 'Partenaire introuvable' });

    const proServiceIds = await ProService.distinct('_id', { pro: userId });

    const [
      serviceCount,
      activeServiceCount,
      transactionCount,
      revenueAgg,
      reviewStats,
      propertyCount,
    ] = await Promise.all([
      ProService.countDocuments({ pro: userId, status: { $ne: 'deleted' } }),
      ProService.countDocuments({ pro: userId, status: 'active' }),
      ServiceOrder.countDocuments({
        service: { $in: proServiceIds },
        status: { $in: ACTIVE_ORDER_STATUSES },
      }),
      ServiceOrder.aggregate([
        { $match: { status: { $in: REVENUE_STATUSES } } },
        {
          $lookup: {
            from: ProService.collection.name,
            localField: 'service',
            foreignField: '_id',
            as: 'svc',
          },
        },
        { $unwind: '$svc' },
        { $match: { 'svc.pro': userId } },
        { $group: { _id: null, revenueTTC: { $sum: '$totalPriceTTC' } } },
      ]),
      ServiceReview.aggregate([
        { $match: { pro: userId } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' } } },
      ]),
      Property.countDocuments({ addedBy: userId, isDeleted: false }),
    ]);

    const revenueTTC = Math.round(((revenueAgg[0]?.revenueTTC) || 0) * 100) / 100;
    const reviewCount = reviewStats[0]?.count || 0;
    const averageRating = reviewStats[0]?.avg ? Math.round(reviewStats[0].avg * 10) / 10 : 0;

    return res.json({
      success: true,
      data: {
        id: String(user._id),
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName || null,
        email: user.email || null,
        mobileNo: user.mobileNo || null,
        image: pickAvatar(user),
        initials: computeInitials(user),
        role: user.role,
        accountType: user.accountType,
        city: user.city || null,
        createdAt: user.createdAt,
        status: user.status,
        isGlobalFavorite: !!user.isGlobalFavorite,
        isLocalFavorite: !!user.isLocalFavorite,
        isTopAgent: !!user.isTopAgent,
        localFavoritePostalCodes: user.localFavoritePostalCodes || [],
        partnerAssignedAt: user.partnerAssignedAt || null,
        featured: {
          subheading: user.featuredSubheading || '',
          title: user.featuredTitle || '',
          bio: user.featuredBio || '',
          experienceYears: user.featuredExperienceYears || 0,
          clientsAccompanied: user.featuredClientsAccompanied || 0,
          ratingNotes: user.featuredRatingNotes || '',
          satisfactionRate: user.featuredSatisfactionRate || '',
          profilePhoto: user.featuredProfilePhoto || '',
        },
        kpis: {
          serviceCount,
          activeServiceCount,
          transactionCount,
          revenueTTC,
          averageRating,
          reviewCount,
          propertyCount,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── TRANSACTIONS (onglet CA & Transactions) ─────────────────────────────
exports.listPartnerTransactions = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const { ProService, ServiceOrder } = getModels(lang);

    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const { status, sortBy = 'paidAt', order = 'desc', page = 1, count = 10 } = req.query;
    const statusList = csvToArray(status);
    const SORTABLE = ['paidAt', 'totalPriceTTC', 'status', 'createdAt'];
    const sortField = SORTABLE.includes(sortBy) ? sortBy : 'paidAt';
    const sortDir = order === 'asc' ? 1 : -1;

    const proServiceIds = await ProService.distinct('_id', { pro: userId });
    const matchStage = { service: { $in: proServiceIds } };
    if (statusList.length > 0) matchStage.status = { $in: statusList };

    const [total, orders] = await Promise.all([
      ServiceOrder.countDocuments(matchStage),
      ServiceOrder.find(matchStage)
        .populate('buyer', 'firstName lastName fullName email')
        .sort({ [sortField]: sortDir })
        .skip((Number(page) - 1) * Number(count))
        .limit(Number(count))
        .lean(),
    ]);

    const data = orders.map((o) => ({
      id: String(o._id),
      serviceTitle: o.serviceSnapshot?.title || '—',
      buyerName: o.buyer ? (o.buyer.fullName || `${o.buyer.firstName || ''} ${o.buyer.lastName || ''}`.trim() || o.buyer.email) : '—',
      status: o.status,
      quantity: o.quantity,
      totalPriceTTC: o.totalPriceTTC,
      commissionHT: o.commissionHT,
      paidAt: o.paidAt,
      deliveredAt: o.deliveredAt,
      confirmedAt: o.confirmedAt,
      createdAt: o.createdAt,
    }));

    return res.json({ success: true, total, page: Number(page), count: Number(count), data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── SERVICES PROPOSÉS ────────────────────────────────────────────────────
exports.listPartnerServices = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const { ProService } = getModels(lang);

    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const { status, categoryId, page = 1, count = 20 } = req.query;
    const statusList = csvToArray(status);
    const filter = { pro: userId };
    if (statusList.length > 0) filter.status = { $in: statusList };
    else filter.status = { $ne: 'deleted' };

    const categoryObjectId = toObjectId(categoryId);
    if (categoryObjectId) filter.category = categoryObjectId;

    const [total, services] = await Promise.all([
      ProService.countDocuments(filter),
      ProService.find(filter)
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(count))
        .limit(Number(count))
        .lean(),
    ]);

    const data = services.map((s) => ({
      id: String(s._id),
      title: s.title,
      category: s.category ? { id: String(s.category._id), name: s.category.name } : null,
      city: s.city,
      modality: s.modality,
      priceTTC: s.priceTTC,
      status: s.status,
      isFeatured: !!s.isFeatured,
      createdAt: s.createdAt,
    }));

    return res.json({ success: true, total, page: Number(page), count: Number(count), data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── BIENS IMMO ───────────────────────────────────────────────────────────
exports.listPartnerProperties = async (req, res) => {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const { propertyType, q, page = 1, count = 20 } = req.query;
    const filter = { addedBy: userId, isDeleted: false };

    const typeList = csvToArray(propertyType);
    if (typeList.length > 0) {
      // 'offmarket' = synonyme : on accepte mais on traduit en flag
      const realTypes = typeList.filter((t) => ['sale', 'rent', 'directory'].includes(t));
      if (realTypes.length > 0) filter.propertyType = { $in: realTypes };
      if (typeList.includes('offmarket')) filter.offMarket = true;
    }

    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [{ name: rx }, { city: rx }, { address: rx }];
    }

    const [total, props] = await Promise.all([
      Property.countDocuments(filter),
      Property.find(filter)
        .select('name city address surface rooms images propertyType offMarket createdAt')
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(count))
        .limit(Number(count))
        .lean(),
    ]);

    const data = props.map((p) => {
      const firstImage = Array.isArray(p.images) && p.images.length > 0
        ? (typeof p.images[0] === 'string' ? p.images[0] : (p.images[0]?.fileName || null))
        : null;
      return {
        id: String(p._id),
        title: p.name || '—',
        propertyType: p.propertyType,
        offMarket: !!p.offMarket,
        city: p.city || null,
        surface: p.surface || null,
        rooms: p.rooms || null,
        image: firstImage,
        publicUrl: `${USER_FRONTEND_URL}/property-details?id=${String(p._id)}`,
        createdAt: p.createdAt,
      };
    });

    return res.json({ success: true, total, page: Number(page), count: Number(count), data });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── AVIS / NOTATION ──────────────────────────────────────────────────────
exports.listPartnerReviews = async (req, res) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'fr';
    const { ServiceReview } = getModels(lang);

    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const { page = 1, count = 20 } = req.query;
    const filter = { pro: userId };

    const [total, statsAgg, reviews] = await Promise.all([
      ServiceReview.countDocuments(filter),
      ServiceReview.aggregate([
        { $match: { pro: userId } },
        { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$rating' } } },
      ]),
      ServiceReview.find(filter)
        .populate('buyer', 'firstName lastName fullName email')
        .populate({ path: 'order', select: 'serviceSnapshot' })
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(count))
        .limit(Number(count))
        .lean(),
    ]);

    const data = reviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      comment: r.comment || '',
      buyerName: r.buyer ? (r.buyer.fullName || `${r.buyer.firstName || ''} ${r.buyer.lastName || ''}`.trim() || r.buyer.email) : '—',
      serviceTitle: r.order?.serviceSnapshot?.title || '—',
      createdAt: r.createdAt,
    }));

    return res.json({
      success: true,
      total,
      averageRating: statsAgg[0]?.avg ? Math.round(statsAgg[0].avg * 10) / 10 : 0,
      page: Number(page),
      count: Number(count),
      data,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── MAJ DRAPEAUX PARTENAIRE ──────────────────────────────────────────────
exports.updatePartnerFlags = async (req, res) => {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ success: false, message: 'Partenaire introuvable' });
    if (user.accountType !== 'pro') {
      return res.status(400).json({ success: false, message: 'Only pro users can be marked as favorites or top agents.' });
    }

    const isGlobal = !!req.body.isGlobalFavorite;
    const isLocal = !!req.body.isLocalFavorite;
    const isTop = !!req.body.isTopAgent;

    let localCodes = req.body.localFavoritePostalCodes;
    if (typeof localCodes === 'string') {
      localCodes = localCodes.split(',').map((c) => c.trim()).filter(Boolean);
    }
    if (!Array.isArray(localCodes)) localCodes = [];

    if (isLocal && localCodes.length === 0) {
      return res.status(400).json({ success: false, message: 'Local favorite requires at least one postal code.' });
    }

    // Règle : max 2 globaux
    if (isGlobal && !user.isGlobalFavorite) {
      const existingGlobals = await Users.countDocuments({
        accountType: 'pro', isGlobalFavorite: true, isDeleted: false, _id: { $ne: userId },
      });
      if (existingGlobals >= 2) {
        return res.status(400).json({ success: false, message: "Impossible d'ajouter un 3ème favori global." });
      }
    }
    // Règle : max 2 locaux par code postal
    if (isLocal) {
      for (const code of localCodes) {
        const competing = await Users.countDocuments({
          accountType: 'pro', isLocalFavorite: true, isDeleted: false,
          localFavoritePostalCodes: code, _id: { $ne: userId },
        });
        if (competing >= 2) {
          return res.status(400).json({ success: false, message: `Impossible d'ajouter un 3ème favori local pour le code postal ${code}.` });
        }
      }
    }

    user.isGlobalFavorite = isGlobal;
    user.isLocalFavorite = isLocal;
    user.isTopAgent = isTop;
    user.localFavoritePostalCodes = isLocal ? localCodes : [];
    if ((isGlobal || isLocal || isTop) && !user.partnerAssignedAt) {
      user.partnerAssignedAt = new Date();
    }
    if (!isGlobal && !isLocal && !isTop) {
      user.partnerAssignedAt = null;
    }
    await user.save();

    return res.json({
      success: true,
      data: {
        isGlobalFavorite: user.isGlobalFavorite,
        isLocalFavorite: user.isLocalFavorite,
        isTopAgent: user.isTopAgent,
        localFavoritePostalCodes: user.localFavoritePostalCodes,
        partnerAssignedAt: user.partnerAssignedAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

// ─── MAJ BIO (featured) ───────────────────────────────────────────────────
exports.updatePartnerBio = async (req, res) => {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: 'ID invalide' });

    const user = await Users.findOne({ _id: userId });
    if (!user) return res.status(404).json({ success: false, message: 'Partenaire introuvable' });

    const fields = [
      'featuredSubheading', 'featuredTitle', 'featuredBio',
      'featuredExperienceYears', 'featuredClientsAccompanied',
      'featuredRatingNotes', 'featuredSatisfactionRate', 'featuredProfilePhoto',
    ];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        user[f] = req.body[f];
      }
    }
    await user.save();

    return res.json({
      success: true,
      data: {
        subheading: user.featuredSubheading || '',
        title: user.featuredTitle || '',
        bio: user.featuredBio || '',
        experienceYears: user.featuredExperienceYears || 0,
        clientsAccompanied: user.featuredClientsAccompanied || 0,
        ratingNotes: user.featuredRatingNotes || '',
        satisfactionRate: user.featuredSatisfactionRate || '',
        profilePhoto: user.featuredProfilePhoto || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
