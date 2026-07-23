const db = require('../models');
const cacheService = require('../services/cache.service');
const ServiceOrderEn = require('../modules/services-marketplace/models/ServiceOrder_en.model');
const ServiceOrderFr = require('../modules/services-marketplace/models/ServiceOrder_fr.model');

const BACK_WEB_URL = process.env.BACK_WEB_URL || `http://localhost:${process.env.PORT || 6089}`;
const defaultCover = '/assets/img/dashboard/attractivity/attractivity-1.jpg';

// Résout l'URL d'une image de propriété à partir d'un document images[]
const resolvePropertyCoverUrl = (images) => {
  if (!Array.isArray(images) || images.length === 0) return null;
  const img = images[0];
  if (typeof img === 'string') return img;
  if (img && img.file) return `${BACK_WEB_URL}/img/${img.file}`;
  if (img && img.fileName) return `${BACK_WEB_URL}/img/${img.fileName}`;
  return null;
};

// --- Past Transactions helper ---
// Maps property/alert type strings to transactions.local_type
const toLocalType = (type) => {
  const t = (type || '').toLowerCase();
  if (t === 'apartment') return 'Appartement';
  if (t === 'house') return 'Maison';
  return null;
};

// Extracts a 5-digit French postal code from a search string like "75018 Paris, France"
const extractPostalCode = (search) => {
  const m = (search || '').match(/\b\d{5}\b/);
  return m ? m[0] : null;
};

// Maps a mutation_date string ("D/M/YYYY") + year to an ISO date string
const parseMutationDate = (mutationDate, year) => {
  if (!mutationDate) return year ? `${year}-01-01` : null;
  const parts = mutationDate.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return year ? `${year}-01-01` : null;
};

// Builds the pastTransactions section for a given user, using 4 data sources
// and progressive query fallback.
const buildPastTransactions = async (userId) => {
  const KNOWN_YEARS = [2024, 2014]; // most recent first
  const SAMPLE_SIZE = 2;

  // --- Gather criteria from 4 sources (stop at first that yields data) ---
  let criteria = null; // { postalCode, localType, rooms, surface }

  // Source 1: most recently updated active saved alert
  const alert = await db.alerts
    .find({ user_id: userId, isDeleted: false, status: 'active' })
    .sort({ updatedAt: -1 })
    .limit(1)
    .lean()
    .then(r => r[0] || null);
  if (alert?.filteredData) {
    const fd = alert.filteredData;
    const postalCode = extractPostalCode(fd.search);
    const localType = toLocalType(fd.type);
    if (postalCode || localType) {
      criteria = { postalCode, localType, rooms: null, surface: null };
    }
  }

  // Source 2: last created property by user
  if (!criteria) {
    const prop = await db.property
      .find({ addedBy: userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(1)
      .select('zipcode type rooms surface')
      .lean()
      .then(r => r[0] || null);
    if (prop) {
      criteria = {
        postalCode: prop.zipcode || null,
        localType: toLocalType(prop.type),
        rooms: Number(prop.rooms) || null,
        surface: Number(prop.surface) || null,
      };
    }
  }

  // Source 3: last quick search (collection is empty — reserved for future use)

  // Source 4: last followed property
  if (!criteria) {
    const lastFollow = await db.followUnfollow
      .find({ user_id: userId, follow_unfollow: true })
      .sort({ createdAt: -1 })
      .limit(1)
      .lean()
      .then(r => r[0] || null);
    if (lastFollow?.property_id) {
      const prop = await db.property
        .findOne({ _id: lastFollow.property_id })
        .select('zipcode type rooms surface')
        .lean();
      if (prop) {
        criteria = {
          postalCode: prop.zipcode || null,
          localType: toLocalType(prop.type),
          rooms: Number(prop.rooms) || null,
          surface: Number(prop.surface) || null,
        };
      }
    }
  }

  if (!criteria || !criteria.postalCode) {
    return { visible: true, _isMock: false, items: [] };
  }

  // --- Progressive query fallback (most specific → postal code only) ---
  // Each attempt removes one criterion; we stop as soon as we get >= SAMPLE_SIZE results.
  const baseFilter = { land_value_num: { $gt: 0 }, real_built_surface_num: { $gt: 0 } };

  const buildAttempts = ({ postalCode, localType, rooms, surface }) => {
    const attempts = [];
    const surfaceFilter = surface
      ? { $gte: surface - Math.max(15, surface * 0.3), $lte: surface + Math.max(15, surface * 0.3) }
      : null;

    // Attempt 1: postalCode + localType + rooms + surface
    if (postalCode && localType && rooms && surfaceFilter) {
      attempts.push({ postal_code: postalCode, local_type: localType, number_of_main_pieces_num: rooms, real_built_surface_num: surfaceFilter });
    }
    // Attempt 2: postalCode + localType + rooms (no surface)
    if (postalCode && localType && rooms) {
      attempts.push({ postal_code: postalCode, local_type: localType, number_of_main_pieces_num: rooms });
    }
    // Attempt 3: postalCode + localType
    if (postalCode && localType) {
      attempts.push({ postal_code: postalCode, local_type: localType });
    }
    // Attempt 4: postalCode only (last resort)
    if (postalCode) {
      attempts.push({ postal_code: postalCode });
    }
    // Deduplicate (some steps collapse when criteria are already null)
    const seen = new Set();
    return attempts.filter(a => {
      const key = JSON.stringify(a);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const attempts = buildAttempts(criteria);

  let sampledDocs = [];
  outerLoop:
  for (const year of KNOWN_YEARS) {
    for (const extra of attempts) {
      const matchStage = { ...baseFilter, year, ...extra };
      const count = await db.pastTransaction.countDocuments(matchStage);
      if (count >= SAMPLE_SIZE) {
        sampledDocs = await db.pastTransaction.aggregate([
          { $match: matchStage },
          { $sample: { size: SAMPLE_SIZE } },
        ]);
        break outerLoop;
      }
    }
  }

  // Last resort: any year, postal code only
  if (sampledDocs.length < SAMPLE_SIZE && criteria.postalCode) {
    const matchStage = { ...baseFilter, postal_code: criteria.postalCode };
    const count = await db.pastTransaction.countDocuments(matchStage);
    if (count >= SAMPLE_SIZE) {
      sampledDocs = await db.pastTransaction.aggregate([
        { $match: matchStage },
        { $sample: { size: SAMPLE_SIZE } },
      ]);
    }
  }

  const items = sampledDocs.map(tx => ({
    id: String(tx._id),
    propertyType: tx.local_type || 'Bien',
    price: tx.land_value_num,
    surface: tx.real_built_surface_num,
    rooms: tx.number_of_main_pieces_num,
    locationLabel: tx.community_name || tx.postal_code,
    fullAddress: [tx.address_number, tx.address_channel_name, tx.postal_code, tx.community_name]
      .filter(Boolean).join(' '),
    soldAt: parseMutationDate(tx.mutation_date, tx.year),
  }));

  return { visible: true, _isMock: false, items };
};

// Shared: get reference postal code from the same 4 sources used by buildPastTransactions
const getReferencePostalCode = async (userId) => {
  // Parallel race: try all sources simultaneously, return first result
  const results = await Promise.allSettled([
    // Source 1: most recent active saved alert
    db.alerts
      .find({ user_id: userId, isDeleted: false, status: 'active' })
      .sort({ updatedAt: -1 }).limit(1).lean()
      .then(r => {
        const a = r[0];
        if (a?.filteredData) {
          const pc = extractPostalCode(a.filteredData.search);
          return pc || null;
        }
        return null;
      }),
    // Source 2: last created property
    db.property
      .find({ addedBy: userId, isDeleted: false })
      .sort({ createdAt: -1 }).limit(1).select('zipcode').lean()
      .then(r => r[0]?.zipcode || null),
  ]);

  const postalCode = results.find(r => r.status === 'fulfilled' && r.value)?.value || null;
  if (postalCode) return postalCode;

  // Source 3 (fallback): last followed property
  try {
    const lastFollow = await db.followUnfollow
      .find({ user_id: userId, follow_unfollow: true })
      .sort({ createdAt: -1 }).limit(1).lean()
      .then(r => r[0] || null);
    if (lastFollow?.property_id) {
      const followedProp = await db.property
        .findOne({ _id: lastFollow.property_id }).select('zipcode').lean();
      return followedProp?.zipcode || null;
    }
  } catch (_) {}

  return null;
};

// Builds P2P report section: aggregated peer estimations for user's own properties
const buildP2PReport = async (userId) => {
  const properties = await db.property
    .find({ addedBy: userId, isDeleted: false })
    .select('_id propertyTitle rooms surface zipcode city country images createdAt')
    .lean();

  if (properties.length === 0) {
    return {
      visible: true,
      _isMock: false,
      emptyState: { message: 'Aucun bien dans votre portefeuille.' },
      action: null,
      properties: [],
    };
  }

  const propIds = properties.map((p) => p._id);

  const estimationsByProp = await db.peerEstimation.aggregate([
    { $match: { propertyId: { $in: propIds } } },
    {
      $group: {
        _id: '$propertyId',
        count: { $sum: 1 },
        mostRecent: { $max: '$createdAt' },
        appropriate: { $sum: { $cond: [{ $eq: ['$referencePrice', 'appropriate'] }, 1, 0] } },
        underEstimated: { $sum: { $cond: [{ $eq: ['$referencePrice', 'underestimated'] }, 1, 0] } },
        overEstimated: { $sum: { $cond: [{ $eq: ['$referencePrice', 'expensive'] }, 1, 0] } },
        maxPrice: { $max: '$userReasonablePrice' },
        avgPrice: { $avg: '$userReasonablePrice' },
        minPrice: { $min: '$userReasonablePrice' },
        avgTitle: { $avg: '$ratePropertyTitle' },
        avgPictures: { $avg: '$ratePropertyPictures' },
        avgInteriorDesign: { $avg: '$rateInteriorDesign' },
        avgLocation: { $avg: '$rateLocation' },
        avgCouldLiveIn: { $avg: '$rateCouldYouLiveIn' },
      },
    },
  ]);

  const estimationsMap = {};
  estimationsByProp.forEach((e) => { estimationsMap[String(e._id)] = e; });

  const allEntries = properties.map((p) => {
    const est = estimationsMap[String(p._id)];
    const hasEstimations = !!(est && est.count > 0);

    const entry = {
      propertyId: String(p._id),
      hasEstimations,
      _sortKey: hasEstimations ? est.mostRecent : null,
      _createdAt: p.createdAt || new Date(0),
      property: {
        title: p.propertyTitle || '',
        rooms: p.rooms || 0,
        surface: p.surface || 0,
        postalCode: p.zipcode || '',
        city: p.city || '',
        country: p.country || 'France',
        imageUrl: resolvePropertyCoverUrl(p.images) || defaultCover,
      },
      action: { route: '/social-estimation' },
    };

    if (hasEstimations) {
      entry.pricing = {
        appropriate: est.appropriate,
        underEstimated: est.underEstimated,
        overEstimated: est.overEstimated,
        maxPrice: Math.round(est.maxPrice || 0),
        avgPrice: Math.round(est.avgPrice || 0),
        minPrice: Math.round(est.minPrice || 0),
        maxUsers: est.count,
        avgUsers: est.count,
        minUsers: est.count,
      };
      const round1 = (v) => Math.round((v || 0) * 10) / 10;
      entry.qualitativeAssessment = {
        title: round1(est.avgTitle),
        pictures: round1(est.avgPictures),
        interiorDesign: round1(est.avgInteriorDesign),
        location: round1(est.avgLocation),
        couldLiveIn: round1(est.avgCouldLiveIn),
        titleUsers: est.count,
        picturesUsers: est.count,
        interiorDesignUsers: est.count,
        locationUsers: est.count,
        couldLiveInUsers: est.count,
      };
    }

    return entry;
  });

  // Sort: properties with estimations first (most recent first), then without (newest property first)
  allEntries.sort((a, b) => {
    if (a.hasEstimations && b.hasEstimations) return new Date(b._sortKey) - new Date(a._sortKey);
    if (a.hasEstimations) return -1;
    if (b.hasEstimations) return 1;
    return new Date(b._createdAt) - new Date(a._createdAt);
  });

  const DISPLAY_LIMIT = 3;
  const propertyEntries = allEntries.slice(0, DISPLAY_LIMIT).map((entry, index) => {
    const out = { ...entry, defaultExpanded: entry.hasEstimations && index === 0 };
    delete out._sortKey;
    delete out._createdAt;
    return out;
  });

  return {
    visible: true,
    _isMock: false,
    emptyState: null,
    action: null,
    totalCount: allEntries.length,
    properties: propertyEntries,
  };
};

// Builds P2P estimation section: sample of properties at user's reference postal code
const buildP2PEstimation = async (userId) => {
  const SAMPLE_SIZE = 6;
  const postalCode = await getReferencePostalCode(userId);
  if (!postalCode) return { ...mockP2PEstimation };

  const query = { zipcode: postalCode, isDeleted: false, addedBy: { $ne: userId } };

  const [total, props] = await Promise.all([
    db.property.countDocuments(query),
    db.property.find(query).select('images').limit(SAMPLE_SIZE).lean(),
  ]);

  if (props.length === 0) return { ...mockP2PEstimation };

  const items = props.map(p => ({
    propertyId: String(p._id),
    imageUrl: resolvePropertyCoverUrl(p.images) || defaultCover,
    route: `/property-details?id=${p._id}`,
  }));

  return {
    visible: true,
    _isMock: false,
    totalPropertiesToEstimate: total,
    items,
    action: { ctaLabel: 'P2P Estimation', route: '/estimation' },
  };
};

const toPropertyCard = (p) => ({
  propertyId: p._id || p.id,
  property: {
    title: p.propertyTitle || p.title || p.name || '',
    coverUrl: resolvePropertyCoverUrl(p.images) || p.imageUrl || p.coverUrl || defaultCover,
  },
  metrics: {
    views: { value: p.propertyViewerCount || 0, deltaPct: 0 },
    followers: { value: (p.follow && p.follow.length) || (p.followersCount || 0), deltaPct: 0 },
    shares: { value: p.shareCount || 0, deltaPct: 0 },
    messages: { value: p.visitBookedCount || 0, deltaPct: 0 },
  },
});

const mockFollowedPropertyNews = {
  visible: true,
  _isMock: true,
  items: [
    {
      id: 'news-1',
      occurredAt: '2026-04-14T09:30:00.000Z',
      newsTitle: 'Changement de prix',
      property: {
        id: 'prop-news-1',
        title: 'Maison familiale',
        status: 'À vendre',
        rooms: 5,
        surface: 110,
        location: '75018 Paris',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg',
      },
    },
    {
      id: 'news-2',
      occurredAt: '2026-04-14T08:10:00.000Z',
      newsTitle: 'Travaux renseignés',
      property: {
        id: 'prop-news-2',
        title: 'Appartement lumineux',
        status: 'Off-market',
        rooms: 3,
        surface: 64,
        location: '69003 Lyon',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      },
    },
    {
      id: 'news-3',
      occurredAt: '2026-04-13T16:45:00.000Z',
      newsTitle: 'Changement de statut : à vendre',
      property: {
        id: 'prop-news-3',
        title: 'Loft urbain',
        status: 'À vendre',
        rooms: 4,
        surface: 92,
        location: '33000 Bordeaux',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg',
      },
    },
    {
      id: 'news-4',
      occurredAt: '2026-04-12T10:20:00.000Z',
      newsTitle: 'Changement de propriétaire',
      property: {
        id: 'prop-news-4',
        title: 'Villa contemporaine',
        status: 'Vendu',
        rooms: 6,
        surface: 160,
        location: '06130 Grasse',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp',
      },
    },
    {
      id: 'news-5',
      occurredAt: '2026-04-11T14:00:00.000Z',
      newsTitle: 'Revenus locatifs ajoutés',
      property: {
        id: 'prop-news-5',
        title: 'T2 centre-ville',
        status: 'Loué',
        rooms: 2,
        surface: 46,
        location: '44000 Nantes',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg',
      },
    },
    {
      id: 'news-6',
      occurredAt: '2026-04-10T11:30:00.000Z',
      newsTitle: 'Dépenses ajoutées',
      property: {
        id: 'prop-news-6',
        title: 'Maison de ville',
        status: 'À vendre',
        rooms: 4,
        surface: 97,
        location: '31000 Toulouse',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg',
      },
    },
    {
      id: 'news-7',
      occurredAt: '2026-04-09T13:05:00.000Z',
      newsTitle: 'Changement de prix',
      property: {
        id: 'prop-news-7',
        title: 'Duplex terrasse',
        status: 'À vendre',
        rooms: 4,
        surface: 88,
        location: '13008 Marseille',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      },
    },
    {
      id: 'news-8',
      occurredAt: '2026-04-09T09:00:00.000Z',
      newsTitle: 'Travaux renseignés',
      property: {
        id: 'prop-news-8',
        title: 'Studio meublé',
        status: 'Loué',
        rooms: 1,
        surface: 27,
        location: '67000 Strasbourg',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg',
      },
    },
    {
      id: 'news-9',
      occurredAt: '2026-04-08T17:30:00.000Z',
      newsTitle: 'Changement de statut : à vendre',
      property: {
        id: 'prop-news-9',
        title: 'Pavillon jardin',
        status: 'À vendre',
        rooms: 5,
        surface: 124,
        location: '59000 Lille',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp',
      },
    },
    {
      id: 'news-10',
      occurredAt: '2026-04-08T08:10:00.000Z',
      newsTitle: 'Revenus ajoutés',
      property: {
        id: 'prop-news-10',
        title: 'Appartement standing',
        status: 'Loué',
        rooms: 3,
        surface: 73,
        location: '34000 Montpellier',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg',
      },
    },
  ],
};

const mockPastTransactions = {
  visible: true,
  _isMock: true,
  items: [
    {
      id: 'tx-1',
      imageUrl: '/assets/img/blogs/blog-2.png',
      propertyType: 'Maison',
      price: 250000,
      surface: 75,
      rooms: 5,
      locationLabel: 'Paris',
      fullAddress: '7 rue poulet, 75018 Paris, France',
      soldAt: '2025-09-01',
    },
    {
      id: 'tx-2',
      imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      propertyType: 'Appartement',
      price: 415000,
      surface: 89,
      rooms: 4,
      locationLabel: 'Lyon',
      fullAddress: '21 rue de la République, 69002 Lyon, France',
      soldAt: '2024-11-18',
    },
  ],
};

const mockP2PEstimation = {
  visible: true,
  _isMock: true,
  title: '100 new properties in your area are waiting for your peer-to-peer estimation',
  subtitle: 'Aidez les propriétaires en donnant votre avis',
  totalPropertiesToEstimate: 100,
  items: [
    { propertyId: 'pe-1', imageUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg', route: '/property-details?id=pe-1' },
    { propertyId: 'pe-2', imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg', route: '/property-details?id=pe-2' },
    { propertyId: 'pe-3', imageUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg', route: '/property-details?id=pe-3' },
    { propertyId: 'pe-4', imageUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp', route: '/property-details?id=pe-4' },
    { propertyId: 'pe-5', imageUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg', route: '/property-details?id=pe-5' },
  ],
  action: {
    ctaLabel: 'P2P Estimation',
    route: '/estimation',
  },
};

const mockP2PReport = {
  visible: true,
  _isMock: true,
  emptyState: null,
  action: null,
  properties: [
    {
      propertyId: 'report-1',
      defaultExpanded: true,
      property: {
        title: 'Maison familiale',
        rooms: 5,
        surface: 90,
        postalCode: '75018',
        city: 'Paris',
        country: 'France',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      },
      pricing: {
        appropriate: 400,
        underEstimated: 300,
        overEstimated: 100,
        minPrice: 760000,
        avgPrice: 800000,
        maxPrice: 840000,
        minUsers: 14,
        avgUsers: 23,
        maxUsers: 31,
      },
      qualitativeAssessment: {
        title: 4.2,
        pictures: 4.0,
        interiorDesign: 4.1,
        location: 4.3,
        couldLiveIn: 4.2,
        titleUsers: 94,
        picturesUsers: 88,
        interiorDesignUsers: 73,
        locationUsers: 101,
        couldLiveInUsers: 67,
      },
      action: { route: '/social-estimation' },
    },
    {
      propertyId: 'report-2',
      defaultExpanded: true,
      property: {
        title: 'Appartement lumineux',
        rooms: 3,
        surface: 68,
        postalCode: '69006',
        city: 'Lyon',
        country: 'France',
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp',
      },
      pricing: {
        appropriate: 280,
        underEstimated: 140,
        overEstimated: 65,
        minPrice: 385000,
        avgPrice: 420000,
        maxPrice: 465000,
        minUsers: 9,
        avgUsers: 16,
        maxUsers: 22,
      },
      qualitativeAssessment: {
        title: 4.0,
        pictures: 3.8,
        interiorDesign: 4.1,
        location: 4.4,
        couldLiveIn: 4.1,
        titleUsers: 62,
        picturesUsers: 58,
        interiorDesignUsers: 51,
        locationUsers: 70,
        couldLiveInUsers: 49,
      },
      action: { route: '/social-estimation' },
    },
  ],
};

const mockTrainingCenter = {
  visible: true,
  _isMock: true,
  items: [
    {
      id: 'train-1',
      authorName: 'Username',
      authorAvatarUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp',
      imageUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg',
      category: 'Owning',
      title: 'Comment définir le prix de votre bien ?',
      consumptionTime: '3 minutes',
      contentType: 'written',
      route: '/blog-detail',
    },
    {
      id: 'train-2',
      authorName: 'Username',
      authorAvatarUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg',
      imageUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      category: 'Renting',
      title: '5 conseils pour bien organiser une visite de votre bien',
      consumptionTime: '5 minutes',
      contentType: 'video',
      route: '/learning-center',
    },
    {
      id: 'train-3',
      authorName: 'Username',
      authorAvatarUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
      imageUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg',
      category: 'Selling',
      title: 'Comment optimiser votre annonce avant publication',
      consumptionTime: '4 minutes',
      contentType: 'written',
      route: '/learning-center',
    },
  ],
};

const resolveUserImg = (image) => {
  if (!image) return null;
  if (image.startsWith('http')) return image;
  return `${BACK_WEB_URL}/img/${image}`;
};

const buildTrainingCenter = async () => {
  try {
    const mongoose = require('mongoose');
    const [videos, articles] = await Promise.all([
      db.funnelUrl
        .find({ status: 'active' })
        .populate('addedBy', 'fullName firstName image')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
      db.blogs
        .find({ status: 'active', isDeleted: false })
        .populate('blogOwner', 'fullName firstName image')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(),
    ]);

    // Collect unique persona IDs from videos (type or topic that look like ObjectIds)
    const personaIds = [...new Set(
      videos.flatMap(v => [v.type, v.topic].filter(
        val => val && mongoose.Types.ObjectId.isValid(val)
      ))
    )];
    const personaMap = {};    // objectId -> name
    const personaKeyMap = {}; // objectId -> key
    if (personaIds.length > 0) {
      const personas = await db.persona.find({ _id: { $in: personaIds } }).select('_id name key').lean();
      personas.forEach(p => {
        personaMap[p._id.toString()] = p.name;
        personaKeyMap[p._id.toString()] = p.key || p.name?.toLowerCase().replace(/[^a-z0-9]+/g, '_') || '';
      });
    }

    const resolveCategory = (val) => {
      if (!val) return '';
      if (mongoose.Types.ObjectId.isValid(val) && personaMap[val.toString()]) {
        return personaMap[val.toString()];
      }
      return val;
    };

    const mapVideo = (v) => ({
      id: v._id.toString(),
      contentType: 'video',
      title: v.title || '',
      title_fr: v.title_fr || '',
      consumptionTime: v.duration || '5 min',
      categoryKey: personaKeyMap[v.type?.toString()] || null,
      category: resolveCategory(v.type) || resolveCategory(v.topic) || '',
      authorName: v.addedBy?.fullName || v.addedBy?.firstName || v.videoOwner || 'Bookaroo',
      authorAvatarUrl: resolveUserImg(v.addedBy?.image),
      imageUrl: v.image ? `${BACK_WEB_URL}/img/${v.image}` : null,
      youtubeUrl: v.youtubeUrl || null,
      route: '/learning-center',
      _createdAt: v.createdAt,
    });

    const mapArticle = (a) => {
      let imageUrl = null;
      if (Array.isArray(a.images) && a.images.length > 0) {
        const img = a.images[0];
        imageUrl = typeof img === 'string' ? img : (img.file ? `${BACK_WEB_URL}/img/${img.file}` : null);
      } else if (a.banner) {
        imageUrl = a.banner;
      }
      return {
        id: a._id.toString(),
        contentType: 'article',
        title: a.title || '',
        title_fr: a.title_fr || '',
        consumptionTime: a.duration || '3 min',
        categoryKey: a.categoryId?.key || null,
        category: a.categoryId?.name || '',
        authorName: a.blogOwner?.fullName || a.blogOwner?.firstName || 'Bookaroo',
        authorAvatarUrl: resolveUserImg(a.blogOwner?.image),
        imageUrl,
        route: `/blog-own-detail?blogId=${a._id}`,
        _createdAt: a.createdAt,
      };
    };

    const combined = [...videos.map(mapVideo), ...articles.map(mapArticle)]
      .sort((a, b) => new Date(b._createdAt) - new Date(a._createdAt))
      .slice(0, 3)
      .map(({ _createdAt, ...item }) => item);

    if (combined.length === 0) return mockTrainingCenter;

    return { visible: true, _isMock: false, items: combined };
  } catch {
    return mockTrainingCenter;
  }
};

const mockPropertySearchPipeline = {
  visible: true,
  _isMock: true,
  emptyState: null,
  metrics: {
    propertyProfileViewed: 100,
    propertiesFollowed: 30,
    propertiesInTransactionFlow: 15,
    propertiesVisited: 10,
    visitReviewsReceived: 5,
    applicationSentToOwners: 5,
    purchaseProposalsSentToOwners: 5,
  },
};

// Builds owner pipeline section: real property metrics for each of the user's properties
const buildOwnerPipeline = async (userId) => {
  const properties = await db.property
    .find({ addedBy: userId, isDeleted: false })
    .select('_id propertyTitle propertyType rooms surface zipcode city country price propertyMonthlyCharges images propertyViewerCount createdAt')
    .sort({ createdAt: -1 })
    .lean();

  if (properties.length === 0) {
    return {
      visible: true,
      _isMock: false,
      emptyState: { message: 'Aucun bien dans votre portefeuille.', ctaRoute: '/property1', ctaLabel: 'Ajouter un bien' },
      totalCount: 0,
      properties: [],
    };
  }

  const propIds = properties.map((p) => p._id);

  const [interestAgg, reviewAgg] = await Promise.all([
    db.interests.aggregate([
      { $match: { propertyId: { $in: propIds } } },
      {
        $group: {
          _id: '$propertyId',
          totalInterests: { $sum: 1 },
          profileAnalyzed: {
            $sum: {
              $cond: [{ $in: ['$funnelStatus', ['buyer requested for document', 'document send by owner', 'offer submit by user', 'confirmation by user', 'renter assigned', 'application submit by user', 'transferred']] }, 1, 0],
            },
          },
          visitsHosted: {
            $sum: {
              $cond: [{ $in: ['$funnelStatus', ['visit hosted', 'review submit by user', 'buyer requested for document', 'document send by owner', 'offer submit by user', 'confirmation by user', 'renter assigned', 'application submit by user', 'transferred']] }, 1, 0],
            },
          },
          visitReviews: { $sum: { $cond: [{ $eq: ['$funnelStatus', 'review submit by user'] }, 1, 0] } },
          offersReceived: {
            $sum: { $cond: [{ $in: ['$funnelStatus', ['offer submit by user', 'confirmation by user', 'transferred']] }, 1, 0] },
          },
          applicationsReceived: {
            $sum: { $cond: [{ $in: ['$funnelStatus', ['application submit by user', 'renter assigned', 'transferred']] }, 1, 0] },
          },
        },
      },
    ]),
    db.reviews.aggregate([
      { $match: { propertyId: { $in: propIds }, isDeleted: false } },
      { $group: { _id: '$propertyId', count: { $sum: 1 } } },
    ]),
  ]);

  const metricsMap = {};
  interestAgg.forEach((e) => { metricsMap[String(e._id)] = e; });
  const reviewMap = {};
  reviewAgg.forEach((e) => { reviewMap[String(e._id)] = e.count; });

  const propertyEntries = properties.map((p) => {
    const m = metricsMap[String(p._id)] || {};
    const isRent = p.propertyType === 'rent';
    const isDirectory = p.propertyType === 'directory' || p.propertyType === 'offmarket';
    return {
      propertyId: String(p._id),
      property: {
        title: p.propertyTitle || '',
        transactionType: isRent ? 'rent' : isDirectory ? 'directory' : 'sale',
        rooms: p.rooms || 0,
        surface: p.surface || 0,
        postalCode: p.zipcode || '',
        city: p.city || '',
        country: p.country || 'France',
        price: isRent ? (p.propertyMonthlyCharges || p.price || 0) : (p.price || 0),
        pricePerSqm: (p.surface && p.price) ? Math.round(p.price / p.surface) : 0,
        imageUrl: resolvePropertyCoverUrl(p.images) || defaultCover,
      },
      metrics: {
        propertyProfileViews: p.propertyViewerCount || 0,
        interestsReceived: m.totalInterests || 0,
        buyerFinancialProfileAnalyzed: isRent ? 0 : (m.profileAnalyzed || 0),
        renterFinancialProfileAnalyzed: isRent ? (m.profileAnalyzed || 0) : 0,
        visitsHosted: m.visitsHosted || 0,
        visitReviewsReceived: reviewMap[String(p._id)] || 0,
        offerReceived: isRent ? 0 : (m.offersReceived || 0),
        applicationReceived: isRent ? (m.applicationsReceived || 0) : 0,
      },
    };
  });

  return {
    visible: true,
    _isMock: false,
    emptyState: null,
    totalCount: propertyEntries.length,
    properties: propertyEntries,
  };
};

const mockOwnerPipeline = {
  visible: true,
  _isMock: true,
  emptyState: null,
  properties: [
    {
      propertyId: 'owner-1',
      property: {
        title: 'Maison familiale',
        transactionType: 'sale',
        rooms: 5,
        surface: 90,
        postalCode: '75018',
        city: 'Paris',
        country: 'France',
        price: 900000,
        pricePerSqm: 10000,
        imageUrl: '/assets/img/blogs/blog-2.png',
      },
      metrics: {
        propertyProfileViews: 300,
        interestsReceived: 30,
        buyerFinancialProfileAnalyzed: 15,
        renterFinancialProfileAnalyzed: 0,
        visitsHosted: 7,
        visitReviewsReceived: 5,
        offerReceived: 3,
        applicationReceived: 0,
      },
    },
    {
      propertyId: 'owner-2',
      property: {
        title: 'Appartement lumineux',
        transactionType: 'rent',
        rooms: 3,
        surface: 64,
        postalCode: '69003',
        city: 'Lyon',
        country: 'France',
        price: 1450,
        pricePerSqm: 23,
        imageUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp',
      },
      metrics: {
        propertyProfileViews: 128,
        interestsReceived: 18,
        buyerFinancialProfileAnalyzed: 0,
        renterFinancialProfileAnalyzed: 11,
        visitsHosted: 6,
        visitReviewsReceived: 4,
        offerReceived: 0,
        applicationReceived: 2,
      },
    },
  ],
};

module.exports = {
  // GET /dashboard/overview
  getOverview: async (req, res) => {
    try {
      const user = req.identity;
      if (!user) return res.status(401).json({ success: false, error: { code: 401, message: 'Authentication required.' } });

      const userId = user._id;

      if (req.isGuest) {
        console.log(`[FrontendDashboardController] guest dashboard overview for ${req.method} ${req.originalUrl}`);
        const data = {
          user: { id: user._id, firstName: user.firstName || user.fullName || 'Guest' },
          meta: { generatedAt: new Date().toISOString(), period: req.query.period || 'day' },
          sections: {
            todoList: {
              visible: true,
              title: 'Votre ToDo Liste',
              subtitle: 'Actions pour faire avancer votre projet immobilier',
              emptyMessage: 'Vous retrouverez ici les actions à mener pour faire avancer votre projet immobilier',
              _isMock: true,
              items: [
                {
                  id: 'todo-1',
                  type: 'SEND_SELLER_FILE',
                  label: 'Envoyer dossier vendeur à Paul Dupont',
                  role: 'OWNER',
                  priority: 1,
                  property: { id: 'prop-1', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg', type: 'Maison', surface: 100, city: 'Paris' },
                  action: { route: '/seller-file' },
                },
                {
                  id: 'todo-2',
                  type: 'BOOK_VISIT',
                  label: 'Inviter Céline D. à visiter',
                  role: 'OWNER',
                  priority: 2,
                  property: { id: 'prop-2', coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg', type: 'Maison', surface: 100, city: 'Paris' },
                  lead: { id: 'lead-2', firstName: 'Céline', lastName: 'D.' },
                  action: { route: '/real-estate-transaction-owner' },
                },
                {
                  id: 'todo-3',
                  type: 'SEND_BUYER_FILE',
                  label: 'Envoyer dossier acheteur à Marc Leroy',
                  role: 'OWNER',
                  priority: 3,
                  property: { id: 'prop-3', coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg', type: 'Appartement', surface: 78, city: 'Lyon' },
                  action: { route: '/buyer-file' },
                },
                {
                  id: 'todo-4',
                  type: 'CREATE_QR_CODE',
                  label: 'Créer le QR code de votre bien',
                  role: 'OWNER',
                  priority: 4,
                  property: { id: 'prop-1', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg', type: 'Maison', surface: 100, city: 'Paris' },
                  action: { route: '/property/qr-code' },
                },
              ],
            },
            propertyAttractivity: {
              visible: true,
              period: req.query.period || 'day',
              emptyState: { message: 'Aucune donnée', ctaLabel: 'Ajouter un bien', ctaRoute: '/properties/new' },
              _isMock: true,
              cards: [
                {
                  propertyId: 'prop-1',
                  property: { title: 'Maison familiale', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg' },
                  metrics: { views: { value: 300, deltaPct: 10 }, followers: { value: 30, deltaPct: 2 }, shares: { value: 7, deltaPct: -1 }, messages: { value: 5, deltaPct: 3 } },
                },
                {
                  propertyId: 'prop-2',
                  property: { title: 'Appartement lumineux', coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg' },
                  metrics: { views: { value: 240, deltaPct: 6 }, followers: { value: 22, deltaPct: 1 }, shares: { value: 5, deltaPct: 1 }, messages: { value: 4, deltaPct: 2 } },
                },
                {
                  propertyId: 'prop-3',
                  property: { title: 'Loft urbain', coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg' },
                  metrics: { views: { value: 198, deltaPct: 4 }, followers: { value: 18, deltaPct: 1 }, shares: { value: 6, deltaPct: 2 }, messages: { value: 3, deltaPct: 1 } },
                },
              ],
            },
            savedSearchResults: {
              visible: true,
              emptyState: { message: 'Aucun saved search', ctaLabel: 'Nouvelle recherche', ctaRoute: '/properties' },
              _isMock: true,
              cards: [
                {
                  savedSearchId: 'search-1',
                  name: 'Search name ABCD',
                  criteriaLabel: 'Vente, Paris',
                  newResultsCount: 20,
                  previewProperties: [
                    { id: 'p-1', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg', route: '/property-details?id=prop-1' },
                    { id: 'p-2', coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg', route: '/property-details?id=prop-2' },
                    { id: 'p-3', coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg', route: '/property-details?id=prop-3' },
                    { id: 'p-4', coverUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp', route: '/property-details?id=prop-4' },
                    { id: 'p-5', coverUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg', route: '/property-details?id=prop-5' },
                  ],
                  action: { route: '/properties?search=true' },
                },
              ],
            },
            followedPropertyNews: mockFollowedPropertyNews,
            pastTransactions: mockPastTransactions,
            p2pEstimation: mockP2PEstimation,
            p2pReport: mockP2PReport,
            trainingCenter: await buildTrainingCenter(),
            propertySearchPipeline: mockPropertySearchPipeline,
            ownerPipeline: mockOwnerPipeline,
          },
        };

        return res.status(200).json({ success: true, data });
      }

      // --- Cache check ---
      const cacheKey = `dashboard:overview:${userId}:${req.query.period || 'day'}`;
      const cached = await cacheService.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, data: cached });

      console.time('dashboard:TOTAL');
      console.time('dashboard:properties');
      // --- propertyAttractivity: latest properties owned by user ---
      const properties = await db.property.find({ addedBy: userId, isDeleted: false }).sort({ createdAt: -1 }).limit(50).lean();
      console.timeEnd('dashboard:properties');
      const propertyAttractivity = {
        visible: true,
        period: req.query.period || 'day',
        emptyState: properties.length === 0 ? { message: 'Aucune donnée', ctaLabel: 'Ajouter un bien', ctaRoute: '/properties/new' } : null,
        _isMock: properties.length === 0,
        cards: properties.length > 0 ? properties.map(toPropertyCard) : [
          {
            propertyId: 'prop-1',
            property: { title: 'Maison familiale', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg' },
            metrics: { views: { value: 300, deltaPct: 10 }, followers: { value: 30, deltaPct: 2 }, shares: { value: 7, deltaPct: -1 }, messages: { value: 5, deltaPct: 3 } },
          },
          {
            propertyId: 'prop-2',
            property: { title: 'Appartement lumineux', coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg' },
            metrics: { views: { value: 240, deltaPct: 6 }, followers: { value: 22, deltaPct: 1 }, shares: { value: 5, deltaPct: 1 }, messages: { value: 4, deltaPct: 2 } },
          },
          {
            propertyId: 'prop-3',
            property: { title: 'Loft urbain', coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg' },
            metrics: { views: { value: 198, deltaPct: 4 }, followers: { value: 18, deltaPct: 1 }, shares: { value: 6, deltaPct: 2 }, messages: { value: 3, deltaPct: 1 } },
          },
        ],
      };

      console.time('dashboard:savedSearches');
      // --- savedSearchResults: user's saved search alerts ---
      // Utilise la collection 'alerts' (avec name, filteredData) et non 'savesearch'
      const buildAlertUrl = (fd) => {
        const parts = [];
        if (fd?.propertyType) parts.push(`propertyType=${encodeURIComponent(fd.propertyType)}`);
        if (fd?.type) parts.push(`type=${encodeURIComponent(fd.type)}`);
        if (fd?.zipcode) parts.push(`zipcode=${encodeURIComponent(fd.zipcode)}`);
        if (fd?.search) parts.push(`search=${encodeURIComponent(fd.search)}`);
        if (fd?.minPrice) parts.push(`minPrice=${fd.minPrice}`);
        if (fd?.maxPrice) parts.push(`maxPrice=${fd.maxPrice}`);
        if (fd?.minSurface) parts.push(`minSurface=${fd.minSurface}`);
        if (fd?.maxSurface) parts.push(`maxSurface=${fd.maxSurface}`);
        if (fd?.rooms) parts.push(`rooms=${fd.rooms}`);
        return `/properties?${parts.join('&')}`;
      };
      // Build a property query matching AlertsController logic exactly
      const buildPropertyQuery = (fd, lastViewedAt) => {
        const qs = { status: 'active' };
        if (fd.propertyType) qs.propertyType = fd.propertyType;
        if (fd.type) qs.type = { $regex: fd.type, $options: 'i' };
        if (fd.zipcode) qs.zipcode = fd.zipcode;
        if (fd.search) {
          const terms = String(fd.search).split(/[\s,]+/).filter(Boolean);
          qs.address = { $in: terms.map((t) => new RegExp(t, 'i')) };
        }
        if (fd.minPrice !== undefined || fd.maxPrice !== undefined) {
          qs.price = {};
          if (fd.minPrice !== undefined) qs.price.$gte = fd.minPrice;
          if (fd.maxPrice !== undefined) qs.price.$lte = fd.maxPrice;
        }
        if (fd.rooms) {
          const roomsArr = Array.isArray(fd.rooms) ? fd.rooms : String(fd.rooms).split(',').map((r) => r.trim());
          qs.rooms = { $in: roomsArr };
        }
        if (lastViewedAt) qs.createdAt = { $gt: new Date(lastViewedAt) };
        return qs;
      };
      const savedSearches = await db.alerts.find({ user_id: userId, isDeleted: false }).sort({ createdAt: -1 }).lean();
      const savedSearchResults = {
        visible: true,
        emptyState: savedSearches.length === 0 ? { message: 'Aucune alerte de recherche', ctaLabel: 'Nouvelle recherche', ctaRoute: '/properties' } : null,
        _isMock: savedSearches.length === 0,
        cards: savedSearches.length > 0 ? await Promise.all(savedSearches.map(async (s) => {
          const fd = s.filteredData || {};
          const [newCount, preview] = await Promise.all([
            db.property.countDocuments(buildPropertyQuery(fd, s.lastViewedAt)),
            db.property.find(buildPropertyQuery(fd, null)).limit(10).lean(),
          ]);
          const criteriaLabel = [fd.type, fd.propertyType, fd.search || fd.zipcode].filter(Boolean).join(' • ');
          return {
            savedSearchId: s._id,
            name: s.name || criteriaLabel || 'Recherche sauvegardée',
            criteriaLabel: criteriaLabel || s.name || '',
            newResultsCount: newCount,
            previewProperties: preview.map(p => ({ id: p._id, coverUrl: resolvePropertyCoverUrl(p.images) || defaultCover, route: `/property-details?id=${p._id}` })),
            action: { route: buildAlertUrl(fd) },
          };
        })) : [
          {
            savedSearchId: 'search-1',
            name: 'Search name ABCD',
            criteriaLabel: 'Vente, Paris',
            newResultsCount: 20,
            previewProperties: [
              { id: 'p-1', coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg', route: '/property-details?id=prop-1' },
              { id: 'p-2', coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg', route: '/property-details?id=prop-2' },
              { id: 'p-3', coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg', route: '/property-details?id=prop-3' },
              { id: 'p-4', coverUrl: '/assets/img/dashboard/attractivity/attractivity-4.webp', route: '/property-details?id=prop-4' },
              { id: 'p-5', coverUrl: '/assets/img/dashboard/attractivity/attractivity-5.jpg', route: '/property-details?id=prop-5' },
            ],
            action: { route: '/properties?search=true' },
          },
        ],
      };
      console.timeEnd('dashboard:savedSearches');

      // --- todoList: simple heuristics based on user role / properties ---
      console.time('dashboard:todoList');
      const todos = [];

      // --- Card 0: CREATE_RENTER_FILE - Shown to renters who haven't created renter file yet ---
      if (user.signupObjective === 'Louer' && !user.renterFilesAddedAt) {
        todos.push({
          id: `todo-renter-file-${user._id}`,
          type: 'CREATE_RENTER_FILE',
          label: 'Créer votre dossier de candidature',
          role: 'SEARCHER',
          priority: 0,
          description: 'Gagnez du temps pour vos candidatures',
          createdAt: new Date(),
          action: { route: '/renter-file' },
        });
      }

      // --- Card 0b: CREATE_BUYER_FILE - Shown to buyers who haven't created buyer file yet ---
      if (user.signupObjective === 'Acheter' && !user.buyerFilesAddedAt) {
        todos.push({
          id: `todo-buyer-file-${user._id}`,
          type: 'CREATE_BUYER_FILE',
          label: 'Créer votre dossier acheteur',
          role: 'SEARCHER',
          priority: 0,
          description: 'Gagnez en crédibilité auprès des vendeurs',
          createdAt: new Date(),
          action: { route: '/buyer-file' },
        });
      }

      // --- Card 0c: CREATE_SELLER_FILE - Shown to sellers/owners who haven't created seller file yet ---
      if (user.signupObjective === 'Vendre' && !user.sellerFilesAddedAt && properties.length > 0) {
        todos.push({
          id: `todo-seller-file-${user._id}`,
          type: 'CREATE_SELLER_FILE',
          label: 'Créer votre dossier de vente',
          role: 'OWNER',
          priority: 0,
          description: 'Vendez plus vite et mieux avec un dossier complet',
          createdAt: new Date(),
          action: { route: '/seller-file' },
        });
      }

      // --- Card 21: CREATE_PROPERTY_PROFILE - Shown to users identified as owners at signup who have no property yet ---
      const ownerSignupObjectives = ['Vendre ma propriété', 'Louer ma propriété', 'Évaluer ma propriété', 'Préparer une vente future'];
      if (ownerSignupObjectives.includes(user.signupObjective) && properties.length === 0) {
        todos.push({
          id: `todo-create-property-profile-${user._id}`,
          type: 'CREATE_PROPERTY_PROFILE',
          label: 'Créer votre annonce immobilière',
          role: 'OWNER',
          priority: 0,
          description: 'Publiez votre bien pour trouver des acheteurs ou locataires',
          createdAt: new Date(),
          action: { route: '/property1' },
        });
      }

      // --- Card 23: FILL_PARTNER_PROFILE - Shown to partner users who haven't filled their encart partenaire yet ---
      const isPartnerUser = user.isLocalFavorite || user.isGlobalFavorite || user.partnerType === 'local' || user.partnerType === 'global';
      if (isPartnerUser && !user.featuredBio) {
        todos.push({
          id: `todo-fill-partner-profile-${user._id}`,
          type: 'FILL_PARTNER_PROFILE',
          label: 'Remplir votre profil partenaire',
          role: 'OWNER',
          priority: 0,
          description: 'Complétez votre encart partenaire pour être mis en avant',
          createdAt: new Date(),
          action: { route: '/profile#partner-card' },
        });
      }

      if (properties.length > 0) {
        // If user is owner, suggest to send seller file or open visit slots
        // No limit - all properties are included, frontend handles pagination
        properties.forEach((p, idx) => {
          todos.push({
            id: `todo-prop-${p._id}`,
            type: 'SEND_SELLER_FILE',
            label: `Constituer le dossier vendeur du bien`,
            role: 'OWNER',
            priority: idx + 1,
            createdAt: p.createdAt,
            property: { id: p._id, coverUrl: resolvePropertyCoverUrl(p.images) || defaultCover, type: p.type || '', surface: p.surface || 0, city: p.city || '' },
            action: { route: `/seller-file?propertyId=${p._id}` },
          });
        });

        // --- Card 22: CREATE_QR_CODE - Une carte par bien en vente ou en location sans QR code ---
        try {
          const saleOrRentProperties = properties.filter(p => p.propertyType === 'sale' || p.propertyType === 'rent');
          for (const p of saleOrRentProperties) {
            const existingQr = await db.qrFlyers.findOne({ propertyId: p._id, isDeleted: false }).lean();
            if (!existingQr) {
              todos.push({
                id: `todo-create-qr-code-${p._id}`,
                type: 'CREATE_QR_CODE',
                label: `Créer le QR code de votre bien`,
                role: 'OWNER',
                priority: 50,
                createdAt: p.createdAt,
                property: { id: p._id, coverUrl: resolvePropertyCoverUrl(p.images) || defaultCover, type: p.type || '', surface: p.surface || 0, city: p.city || '' },
                action: { route: `/property/qr-code?propertyId=${p._id}` },
              });
            }
          }
        } catch (err) {
          console.error('[FrontendDashboardController] Error generating CREATE_QR_CODE cards:', err);
        }

        // --- GROUPE 2: VISITES - Transaction-based visit cards ---
        try {
          // Schema uses buyerId (lead) and propertyId (linked to owner via property.addedBy)
          const propertyIds = properties.map(p => p._id);

          // Interests where user is the lead/searcher
          const asLeadInterests = await db.interests.find({ buyerId: userId }).lean();
          // Interests where user is the owner (via their properties)
          const asOwnerInterests = await db.interests.find({ propertyId: { $in: propertyIds } }).lean();

          const interestEntries = [
            ...asOwnerInterests.map(i => ({ interest: i, isUserOwner: true })),
            ...asLeadInterests.map(i => ({ interest: i, isUserOwner: false })),
          ];

          for (const { interest, isUserOwner } of interestEntries) {
            const funnelStatus = interest.funnelStatus || '';
            const otherUserId = isUserOwner ? interest.buyerId : (interest.propertyId ? null : null);

            // Get property details
            const property = await db.property.findById(interest.propertyId).select('type surface city propertyTitle title images addedBy propertyType listingType').lean();
            if (!property) continue;

            // For owner interests, other user = buyer; for lead interests, other user = property owner
            const resolvedOtherUserId = isUserOwner ? interest.buyerId : property.addedBy;
            const otherUser = await db.users.findById(resolvedOtherUserId).select('firstName lastName').lean();

            if (!otherUser) continue;
            
            const propertyInfo = {
              id: property._id,
              coverUrl: resolvePropertyCoverUrl(property.images) || defaultCover,
              type: property.type || '',
              surface: property.surface || 0,
              city: property.city || ''
            };
            
            const otherUserName = `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim();

            // Card 4: INVITE_TO_VISIT (Owner perspective - status 'interest sent')
            if (isUserOwner && funnelStatus === 'interest sent') {
              todos.push({
                id: `todo-invite-visit-${interest._id}`,
                type: 'INVITE_TO_VISIT',
                label: `Inviter ${otherUserName} pour une visite`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 5: BOOKING_VISIT (Lead perspective - status 'invite user for a visit')
            if (!isUserOwner && funnelStatus === 'invite user for a visit') {
              todos.push({
                id: `todo-booking-visit-${interest._id}`,
                type: 'BOOKING_VISIT',
                label: `Réserver un créneau de visite`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // Card 24: PROPOSE_NEW_VISIT_SLOT (Owner perspective)
            // Trigger : le lead a demandé un changement de créneau de visite
            // Done    : le propriétaire propose un nouveau créneau (funnelStatus quitte ce statut)
            if (isUserOwner && funnelStatus === 'request to change the visit slot') {
              todos.push({
                id: `todo-propose-new-visit-slot-${interest._id}`,
                type: 'PROPOSE_NEW_VISIT_SLOT',
                label: `${otherUserName} demande un nouveau créneau de visite`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 6: SUBMIT_REVIEW (Lead perspective - status 'visit hosted')
            if (!isUserOwner && funnelStatus === 'visit hosted') {
              todos.push({
                id: `todo-submit-review-${interest._id}`,
                type: 'SUBMIT_REVIEW',
                label: `Évaluer la visite`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // --- GROUPE 3: DOSSIERS VENDEUR ---
            
            // Card 7: REQUEST_SELLER_FILE (Lead perspective - after visit hosted)
            if (!isUserOwner && funnelStatus === 'visit hosted') {
              todos.push({
                id: `todo-request-seller-file-${interest._id}`,
                type: 'REQUEST_SELLER_FILE',
                label: `Demander le dossier vendeur`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // Card 8: DOCUMENTS_RECEIVED (Lead perspective - documents sent by owner, at least one file exists)
            const hasDocuments = interest.documents && typeof interest.documents === 'object' &&
              Object.keys(interest.documents).some(k => Array.isArray(interest.documents[k]) && interest.documents[k].length > 0);
            if (!isUserOwner && interest.documentRequested && hasDocuments) {
              todos.push({
                id: `todo-documents-received-${interest._id}`,
                type: 'DOCUMENTS_RECEIVED',
                label: `Dossier vendeur reçu de ${otherUserName}`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // Card 9: SEND_TRANSACTION_DOCUMENTS (Owner perspective - Sale only)
            // Un dossier vendeur n'existe pas pour les biens en location
            const isSaleProperty = property && (property.propertyType === 'sale' || property.listingType === 'sale');
            if (isUserOwner && isSaleProperty && interest.documentRequested && (!interest.documents || Object.keys(interest.documents).length === 0)) {
              todos.push({
                id: `todo-send-transaction-documents-${interest._id}`,
                type: 'SEND_TRANSACTION_DOCUMENTS',
                label: `Envoyer le dossier vendeur à ${otherUserName}`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 10: SEND_OFFER (Lead perspective - Sale only, after visit hosted)
            // Inclut aussi les statuts post-visite où l'acheteur peut encore envoyer son offre
            const isVisitHosted = ['visit hosted', 'buyer requested for document', 'document send by owner'].includes(interest.funnelStatus);
            // offerSubmitted/offerStatus ne sont pas mis à jour par l'app → utiliser funnelStatus comme source de vérité
            const offerFunnelStatuses = ['offer submit by user', 'offer submit by owner', 'offer accept by owner', 'preslot opened by owner', 'preslot accept by owner', 'saleslot accept by user', 'confirmation by user', 'transferred'];
            const hasSubmittedOffer = interest.offerSubmitted || interest.offerStatus === 'submitted' || offerFunnelStatuses.includes(interest.funnelStatus);
            
            if (!isUserOwner && isVisitHosted && isSaleProperty && !hasSubmittedOffer) {
              todos.push({
                id: `todo-send-offer-${interest._id}`,
                type: 'SEND_OFFER',
                label: `Envoyer votre offre`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // Card 11: SEND_APPLICATION (Lead perspective - Rental only, after visit hosted)
            const isRentalProperty = property && (property.propertyType === 'rent' || property.propertyType === 'rental' || property.listingType === 'rent' || property.listingType === 'rental');
            // applicationSubmitted/applicationStatus ne sont pas mis à jour → utiliser funnelStatus
            const applicationFunnelStatuses = ['application submit by user', 'renter assigned', 'transferred'];
            const hasSubmittedApplication = interest.applicationSubmitted || interest.applicationStatus === 'submitted' || applicationFunnelStatuses.includes(interest.funnelStatus);
            
            if (!isUserOwner && isVisitHosted && isRentalProperty && !hasSubmittedApplication) {
              todos.push({
                id: `todo-send-application-${interest._id}`,
                type: 'SEND_APPLICATION',
                label: `Envoyer votre dossier de candidature`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}` },
              });
            }

            // Card 12: RESPOND_TO_OFFER (Owner perspective - Sale only, after lead submits offer)
            // offerSubmitted/offerStatus ne sont pas mis à jour → utiliser funnelStatus comme source de vérité
            const leadSubmittedOffer = (interest.offerSubmitted && interest.offerStatus === 'submitted') || interest.funnelStatus === 'offer submit by user';
            const ownerHasResponded = interest.offerStatus === 'accepted' || interest.offerStatus === 'rejected' || interest.offerStatus === 'counter_offer' || ['offer submit by owner', 'offer accept by owner', 'offer accept by user', 'preslot opened by owner', 'preslot booked by user', 'preslot accept by owner', 'preslot accept by user', 'saleslot booked by owner', 'saleslot booked by user', 'saleslot accept by user', 'confirmation by user', 'transferred'].includes(interest.funnelStatus);
            
            if (isUserOwner && isSaleProperty && leadSubmittedOffer && !ownerHasResponded) {
              todos.push({
                id: `todo-respond-to-offer-${interest._id}`,
                type: 'RESPOND_TO_OFFER',
                label: `Répondre à l'offre de ${otherUserName}`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 13: RESPOND_TO_APPLICATION (Owner perspective - Rental only, after lead submits application)
            // applicationSubmitted/applicationStatus ne sont pas mis à jour → utiliser funnelStatus comme source de vérité
            const leadSubmittedApplication = (interest.applicationSubmitted && interest.applicationStatus === 'submitted') || interest.funnelStatus === 'application submit by user';
            const ownerHasRespondedApp = interest.applicationStatus === 'accepted' || interest.applicationStatus === 'rejected' || interest.funnelStatus === 'renter assigned' || interest.funnelStatus === 'transferred';
            
            if (isUserOwner && isRentalProperty && leadSubmittedApplication && !ownerHasRespondedApp) {
              todos.push({
                id: `todo-respond-to-application-${interest._id}`,
                type: 'RESPOND_TO_APPLICATION',
                label: `Répondre à la candidature de ${otherUserName}`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 14: COUNTER_OFFER_RESPONSE (Lead perspective - Sale only, when owner sends counter-offer)
            // offerStatus n'est jamais mis à jour → utiliser funnelStatus comme source de vérité
            // 'offer submit by owner' = le vendeur a envoyé une contre-offre → l'acheteur doit répondre
            const hasReceivedCounterOffer = interest.offerStatus === 'counter_offer' ||
              (!isUserOwner && interest.funnelStatus === 'offer submit by owner');
            const hasRespondedToCounterOffer = interest.offerStatus === 'accepted' || interest.offerStatus === 'rejected' || interest.offerStatus === 'counter_offer_response' ||
              ['offer accept by user', 'offer accept by owner', 'preslot opened by owner', 'preslot booked by user', 'preslot accept by owner', 'preslot accept by user', 'saleslot booked by owner', 'saleslot booked by user', 'saleslot accept by user', 'confirmation by user', 'transferred'].includes(interest.funnelStatus);
            
            if (isSaleProperty && hasReceivedCounterOffer && !hasRespondedToCounterOffer) {
              todos.push({
                id: `todo-counter-offer-response-${interest._id}`,
                type: 'COUNTER_OFFER_RESPONSE',
                label: `Répondre à la contre-offre`,
                role: isUserOwner ? 'OWNER' : 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: isUserOwner ? `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` : `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 15: INVITE_PRESALE_SIGN (Owner - Sale only)
            // Trigger : offre acceptée (par le proprio ou lead qui accepte la contre-offre) → proprio invite à signer le compromis
            // Done    : propriétaire a ouvert le slot compromis (preslot opened by owner) ou au-delà
            const offerFullyAccepted = ['offer accept by owner', 'offer accept by user'].includes(interest.funnelStatus);
            if (isSaleProperty && isUserOwner && offerFullyAccepted) {
              todos.push({
                id: `todo-invite-presale-sign-${interest._id}`,
                type: 'INVITE_PRESALE_SIGN',
                label: `Inviter ${otherUserName} à signer le compromis de vente`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 16: BOOK_PRESALE_SLOT (Lead - Sale only)
            // Trigger : propriétaire a ouvert le slot compromis (preslot opened by owner)
            // Done    : lead a réservé le slot (preslot booked by user) ou au-delà
            if (isSaleProperty && !isUserOwner && interest.funnelStatus === 'preslot opened by owner') {
              todos.push({
                id: `todo-book-presale-slot-${interest._id}`,
                type: 'BOOK_PRESALE_SLOT',
                label: `Réserver un créneau pour la signature du compromis`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 16b: CONFIRM_PRESALE_SIGN - Propriétaire (Sale only)
            // Trigger : slot accepté/réservé (preslot accept by user OU preslot accept by owner)
            //           → le bouton "Confirm signing" est visible dans BuyerCard/LanderCard à ces deux statuts
            // Done    : dès que l'un des deux confirme la signature (contract signed by owner OU contract signed by user) ou au-delà
            const presaleConfirmationNeeded = ['preslot accept by user', 'preslot accept by owner'].includes(interest.funnelStatus);
            const presaleAlreadyConfirmed = ['contract signed by owner', 'contract signed by user', 'saleslot booked by owner', 'saleslot booked by user', 'saleslot accept by user', 'confirmation by owner', 'confirmation by user', 'transferred'].includes(interest.funnelStatus);
            if (isSaleProperty && isUserOwner && presaleConfirmationNeeded && !presaleAlreadyConfirmed) {
              todos.push({
                id: `todo-confirm-presale-sign-owner-${interest._id}`,
                type: 'CONFIRM_PRESALE_SIGN',
                label: `Confirmer la signature du compromis de vente`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 16c: CONFIRM_PRESALE_SIGN - Lead (Sale only)
            // Même logique : apparaît à preslot booked by user, disparaît dès qu'un des deux confirme
            if (isSaleProperty && !isUserOwner && presaleConfirmationNeeded && !presaleAlreadyConfirmed) {
              todos.push({
                id: `todo-confirm-presale-sign-lead-${interest._id}`,
                type: 'CONFIRM_PRESALE_SIGN',
                label: `Confirmer la signature du compromis de vente`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 17: INVITE_FINAL_SALE_SIGN (Owner - Sale only)
            // Trigger : l'un des deux a confirmé la signature du compromis
            //           (contract signed by owner OU contract signed by user)
            // Done    : propriétaire a ouvert le slot vente finale (saleslot booked by owner) ou au-delà
            if (isSaleProperty && isUserOwner && ['contract signed by owner', 'contract signed by user'].includes(interest.funnelStatus)) {
              todos.push({
                id: `todo-invite-final-sale-sign-${interest._id}`,
                type: 'INVITE_FINAL_SALE_SIGN',
                label: `Inviter ${otherUserName} à signer la vente définitive`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 18: BOOK_FINAL_SALE_SLOT (Lead - Sale only)
            // Trigger : propriétaire a ouvert le slot vente finale (saleslot booked by owner)
            // Done    : lead a réservé le slot vente finale (saleslot booked by user) ou au-delà
            if (isSaleProperty && !isUserOwner && interest.funnelStatus === 'saleslot booked by owner') {
              todos.push({
                id: `todo-book-final-sale-slot-${interest._id}`,
                type: 'BOOK_FINAL_SALE_SLOT',
                label: `Réserver un créneau pour la signature finale`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 19a/19b: CONFIRM_FINAL_SALE_SIGN - Propriétaire + Lead (Sale only)
            // Trigger : le lead a réservé le slot de signature finale (saleslot accept by user)
            //           → le bouton "Final Contract Signed" est visible dans BuyerCard/LeadCards à ce statut
            // Done    : dès que l'un des deux confirme (confirmation by owner OU confirmation by user) ou au-delà
            const finalSignConfirmNeeded = interest.funnelStatus === 'saleslot accept by user';
            const finalSignAlreadyConfirmed = ['confirmation by owner', 'confirmation by user', 'transferred'].includes(interest.funnelStatus);
            if (isSaleProperty && isUserOwner && finalSignConfirmNeeded && !finalSignAlreadyConfirmed) {
              todos.push({
                id: `todo-confirm-final-sale-sign-owner-${interest._id}`,
                type: 'CONFIRM_FINAL_SALE_SIGN',
                label: `Confirmer la signature de la vente définitive`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }
            if (isSaleProperty && !isUserOwner && finalSignConfirmNeeded && !finalSignAlreadyConfirmed) {
              todos.push({
                id: `todo-confirm-final-sale-sign-lead-${interest._id}`,
                type: 'CONFIRM_FINAL_SALE_SIGN',
                label: `Confirmer la signature de la vente définitive`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 19: REQUEST_PROFILE_TRANSFER - Lead (Sale only)
            // Trigger : vente définitive confirmée (confirmation by owner OU confirmation by user)
            //           ET la demande de transfert n'a pas encore été envoyée
            // Done    : propertyTransferRequest === true (set par POST interests/notifyOwner)
            const needsTransferRequest = ['confirmation by owner', 'confirmation by user'].includes(interest.funnelStatus) && !interest.propertyTransferRequest;
            if (isSaleProperty && !isUserOwner && needsTransferRequest) {
              todos.push({
                id: `todo-request-profile-transfer-${interest._id}`,
                type: 'REQUEST_PROFILE_TRANSFER',
                label: `Demander le transfert de propriété`,
                role: 'BUYER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-searcher?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }

            // Card 20: TRANSFER_PROFILE - Propriétaire (Sale only)
            // Trigger : vente définitive confirmée (confirmation by owner/user ou transferred)
            //           ET le transfert de propriété n'est pas encore complété
            // Done    : transferDone === true ET interestStatus === "completed"
            const needsTransfer = ['confirmation by owner', 'confirmation by user', 'transferred'].includes(interest.funnelStatus) && !(interest.transferDone && interest.interestStatus === 'completed');
            if (isSaleProperty && isUserOwner && needsTransfer) {
              todos.push({
                id: `todo-transfer-profile-${interest._id}`,
                type: 'TRANSFER_PROFILE',
                label: `Transférer la propriété à ${otherUserName}`,
                role: 'OWNER',
                priority: 100 + todos.length,
                createdAt: interest.updatedAt || interest.createdAt,
                property: propertyInfo,
                otherUser: { id: resolvedOtherUserId, name: otherUserName },
                transactionId: interest._id,
                action: { route: `/real-estate-transaction-owner?interestId=${interest._id}&propertyId=${interest.propertyId}` },
              });
            }
          }
        } catch (err) {
          console.error('Error fetching transaction visit cards for dashboard:', err);
        }

        // --- Card 1: Rooms where the last message is from someone else (user hasn't replied) ---
        try {
          const userRooms = await db.roommembers.find({ user_id: userId }).select('room_id property_id').lean();

          let replyCount = 0;
          for (const room of userRooms) {
            if (replyCount >= 3) break;

            const lastMsg = await db.messages.findOne({ room_id: room.room_id, isDeleted: false })
              .sort({ createdAt: -1 }).lean();

            if (!lastMsg || lastMsg.sender.toString() === userId.toString()) continue;

            const sender = await db.users.findById(lastMsg.sender).select('firstName lastName').lean();
            if (!sender) continue;

            // Get property from room or message
            const propId = room.property_id || lastMsg.property_id;
            let property = null;
            if (propId) {
              property = await db.property.findById(propId).select('type surface city propertyTitle title images').lean();
            }

            const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
            todos.push({
              id: `todo-msg-${room.room_id}`,
              type: 'REPLY_MESSAGE',
              label: `Répondre au message de ${senderName}`,
              role: 'BUYER',
              createdAt: lastMsg.createdAt,
              property: property ? {
                id: property._id,
                coverUrl: resolvePropertyCoverUrl(property.images) || defaultCover,
                type: property.type || '',
                surface: property.surface || 0,
                city: property.city || ''
              } : null,
              action: { route: `/chat?roomId=${room.room_id}` },
            });
            replyCount++;
          }
        } catch (err) {
          console.error('Error fetching unread messages for dashboard:', err);
        }

        // --- Card 2: Saved search alerts with new results ---
        try {
          const userAlerts = await db.alerts.find({ user_id: userId, isDeleted: false }).sort({ createdAt: -1 }).lean();
          
          for (const alert of userAlerts.slice(0, 3)) {
            const fd = alert.filteredData || {};
            const newCount = await db.property.countDocuments(buildPropertyQuery(fd, alert.lastViewedAt));
            if (newCount > 0) {
              todos.push({
                id: `todo-search-${alert._id}`,
                type: 'NEW_SEARCH_RESULTS',
                label: `${newCount} nouveau${newCount > 1 ? 'x' : ''} bien${newCount > 1 ? 's' : ''} dans "${alert.name || 'votre recherche'}"`,
                role: 'BUYER',
                priority: properties.length + userAlerts.indexOf(alert) + 1,
                createdAt: alert.updatedAt || alert.createdAt,
                searchInfo: {
                  searchId: alert._id,
                  location: fd.search || fd.zipcode || 'Votre région',
                  newResultsCount: newCount,
                },
                action: { route: buildAlertUrl(fd) },
              });
            }
          }
        } catch (err) {
          console.error('Error fetching search alerts for dashboard:', err);
        }

        // --- Card 3: Services pending confirmation (delivered by pro, awaiting buyer confirmation) ---
        try {
          // Search in both English and French ServiceOrder models
          const [serviceOrdersEn, serviceOrdersFr] = await Promise.all([
            ServiceOrderEn.find({
              buyer: userId,
              status: 'delivered_by_pro'
            }).select('serviceSnapshot deliveredAt createdAt').sort({ deliveredAt: -1 }).lean(),
            ServiceOrderFr.find({
              buyer: userId,
              status: 'delivered_by_pro'
            }).select('serviceSnapshot deliveredAt createdAt').sort({ deliveredAt: -1 }).lean()
          ]);

          const allServiceOrders = [...serviceOrdersEn, ...serviceOrdersFr].slice(0, 2);

          for (const order of allServiceOrders) {
            // Service name is stored in serviceSnapshot.title
            const serviceName = order.serviceSnapshot?.title || 'Service acheté';
            todos.push({
              id: `todo-service-${order._id}`,
              type: 'CONFIRM_SERVICE',
              label: 'Confirmez la réalisation du service',
              role: 'BUYER',
              priority: properties.length + allServiceOrders.indexOf(order) + 1,
              createdAt: order.deliveredAt || order.createdAt,
              serviceInfo: {
                serviceId: order._id,
                serviceName: serviceName,
              },
              action: { route: `/marketplace/orders?serviceId=${order._id}` },
            });
          }
        } catch (err) {
          console.error('Error fetching pending services for dashboard:', err);
        }

      } else {
        // If no properties, provide the frontend mock todo items so backend is authoritative
        todos.push(
          {
            id: 'todo-1',
            type: 'SEND_SELLER_FILE',
            label: 'Envoyer dossier vendeur à Paul Dupont',
            role: 'OWNER',
            priority: 1,
            property: {
              id: 'prop-1',
              coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg',
              type: 'Maison',
              surface: 100,
              city: 'Paris',
            },
            action: { route: '/seller-file' },
          },
          {
            id: 'todo-2',
            type: 'BOOK_VISIT',
            label: 'Inviter Céline D. à visiter',
            role: 'OWNER',
            priority: 2,
            property: {
              id: 'prop-2',
              coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
              type: 'Maison',
              surface: 100,
              city: 'Paris',
            },
            lead: { id: 'lead-2', firstName: 'Céline', lastName: 'D.' },
            action: { route: '/real-estate-transaction-owner' },
          },
          {
            id: 'todo-3',
            type: 'SEND_BUYER_FILE',
            label: 'Envoyer dossier acheteur à Marc Leroy',
            role: 'OWNER',
            priority: 3,
            property: {
              id: 'prop-3',
              coverUrl: '/assets/img/dashboard/attractivity/attractivity-3.jpg',
              type: 'Appartement',
              surface: 78,
              city: 'Lyon',
            },
            action: { route: '/buyer-file' },
          }
        );
      }

      // Sort todos by createdAt (most recent first) - backend is authoritative for order
      todos.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      console.timeEnd('dashboard:todoList');
      console.time('dashboard:pastTransactions');
      const todoList = {
        visible: true,
        title: 'Votre ToDo Liste',
        subtitle: 'Actions pour faire avancer votre projet immobilier',
        emptyMessage: 'Vous retrouverez ici les actions à mener pour faire avancer votre projet immobilier',
        _isMock: properties.length === 0,
        items: todos,
      };

      // --- followedPropertyNews: timeline entries for properties followed by user ---
      let followedPropertyNews = { visible: true, _isMock: false, items: [] };
      try {
        // Fetch follow docs with date so we can restrict timeline to post-follow events.
        // Sort desc so the latest follow date wins when the user has followed/unfollowed/re-followed.
        const followDocs = await db.followUnfollow
          .find({ user_id: userId, follow_unfollow: true })
          .select('property_id createdAt')
          .sort({ createdAt: -1 })
          .lean();

        // Build map: propertyId (string) → { date, rawId }  (latest follow wins)
        const followedAtMap = {};
        followDocs.forEach(f => {
          const pid = String(f.property_id);
          if (pid && pid !== 'null' && pid !== 'undefined' && !followedAtMap[pid]) {
            followedAtMap[pid] = { date: f.createdAt, rawId: f.property_id };
          }
        });

        const followedPropertyIds = Object.keys(followedAtMap);

        if (followedPropertyIds.length > 0) {
          const timelineTypeLabel = {
            newPrice: 'Changement de prix',
            priceChanged: 'Changement de prix',
            propertyMonthlyCharges: 'Dépenses ajoutées',
            propertyCreated: 'Bien publié',
            propertyType: 'Type de bien mis à jour',
            revenue_detail: 'Revenus locatifs ajoutés',
            proposal: 'Proposition reçue',
            ownerChange: 'Changement de propriétaire',
            interestStatus: 'Changement de statut',
            renterInterestStatus: 'Changement de statut locataire',
            photosAdded: 'Photos ajoutées',
            statusChanged: 'Changement de statut',
          };
          const getPropertyStatus = (prop) => {
            const pt = (prop.propertyType || '').toLowerCase();
            if (pt === 'sale') return 'À vendre';
            if (pt === 'rent') return 'À louer';
            if (pt === 'offmarket') return 'Off-market';
            return 'Actif';
          };

          const timelineEntries = await db.timeline
            .find({
              $or: followedPropertyIds.map(pid => ({
                propertyId: followedAtMap[pid].rawId,
                createdAt: { $gt: followedAtMap[pid].date },
              })),
            })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

          if (timelineEntries.length > 0) {
            const uniquePropIds = [...new Set(timelineEntries.map(t => String(t.propertyId)))];
            const propDocs = await db.property
              .find({ _id: { $in: uniquePropIds } })
              .select('propertyTitle title type propertyType images rooms surface city zipcode')
              .lean();
            const propMap = {};
            propDocs.forEach(p => { propMap[String(p._id)] = p; });

            followedPropertyNews.items = timelineEntries.map(entry => {
              const prop = propMap[String(entry.propertyId)] || {};
              const location = [prop.zipcode, prop.city].filter(Boolean).join(' ');
              return {
                id: String(entry._id),
                occurredAt: entry.createdAt,
                newsTitle: timelineTypeLabel[entry.type] || entry.type || 'Actualité',
                property: {
                  id: String(entry.propertyId),
                  title: prop.propertyTitle || prop.title || 'Bien immobilier',
                  status: getPropertyStatus(prop),
                  rooms: prop.rooms || 0,
                  surface: prop.surface || 0,
                  location,
                  imageUrl: resolvePropertyCoverUrl(prop.images) || defaultCover,
                  route: `/property-details?id=${entry.propertyId}`,
                  timelineRoute: `/property-timeline?id=${entry.propertyId}`,
                },
              };
            });
          }
        }
      } catch (err) {
        console.error('Error fetching followedPropertyNews:', err);
        followedPropertyNews = { ...mockFollowedPropertyNews };
      }

      // --- propertySearchPipeline: real searcher metrics ---
      let propertySearchPipeline;
      try {
        const [
          savedSearchesCount,
          viewedProps,
          followedCount,
          inTransactionCount,
          visitedCount,
          applicationCount,
          offerCount,
        ] = await Promise.all([
          db.alerts.countDocuments({ user_id: userId, isDeleted: false, status: 'active' }),
          db.interests.distinct('propertyId', { buyerId: userId }).then(r => r.length),
          db.followUnfollow.countDocuments({ user_id: userId, follow_unfollow: true }),
          db.interests.countDocuments({ buyerId: userId, isDeleted: { $ne: true } }),
          db.interests.countDocuments({
            buyerId: userId,
            funnelStatus: { $in: ['visit hosted', 'visit accept by user', 'review submit by user', 'renter assigned', 'transferred'] },
          }),
          // Candidatures = rental interests that reached "application file sent" stage or beyond
          db.interests.countDocuments({ buyerId: userId, propertyType: 'rent', funnelStatus: { $in: ['application submit by user', 'renter assigned'] } }),
          // Offres d'achat = sale interests that reached "purchase offer sent" stage or beyond
          db.interests.countDocuments({ buyerId: userId, propertyType: 'sale', funnelStatus: { $in: ['offer submit by user', 'confirmation by user', 'transferred'] } }),
        ]);
        propertySearchPipeline = {
          visible: true,
          _isMock: false,
          emptyState: null,
          metrics: {
            savedSearches: savedSearchesCount,
            propertyProfileViewed: viewedProps,
            propertiesFollowed: followedCount,
            propertiesInTransactionFlow: inTransactionCount,
            propertiesVisited: visitedCount,
            applicationSentToOwners: applicationCount,
            purchaseProposalsSentToOwners: offerCount,
          },
        };
      } catch (err) {
        console.error('Error fetching propertySearchPipeline:', err);
        propertySearchPipeline = mockPropertySearchPipeline;
      }

      // --- pastTransactions: real historical transactions matching user context ---
      console.timeEnd('dashboard:pastTransactions');
      let pastTransactions = mockPastTransactions;
      try {
        console.time('dashboard:p2pEstimation');
        pastTransactions = await buildPastTransactions(userId);
      } catch (err) {
        console.error('Error fetching pastTransactions:', err);
      }

      // --- p2pEstimation: real properties at user's reference postal code ---
      let p2pEstimation = mockP2PEstimation;
      try {
        p2pEstimation = await buildP2PEstimation(userId);
      } catch (err) {
        console.error('Error fetching p2pEstimation:', err);
      }
      console.timeEnd('dashboard:p2pEstimation');

      // --- p2pReport: real aggregated estimations for user's own properties ---
      console.time('dashboard:p2pReport');
      let p2pReport = mockP2PReport;
      try {
        p2pReport = await buildP2PReport(userId);
      } catch (err) {
        console.error('Error fetching p2pReport:', err);
      }
      console.timeEnd('dashboard:p2pReport');

      // --- ownerPipeline: real metrics for each of user's own properties ---
      console.time('dashboard:ownerPipeline');
      let ownerPipeline = mockOwnerPipeline;
      try {
        ownerPipeline = await buildOwnerPipeline(userId);
      } catch (err) {
        console.error('Error fetching ownerPipeline:', err);
      }
      console.timeEnd('dashboard:ownerPipeline');

      console.time('dashboard:trainingCenter');
      const trainingCenter = await buildTrainingCenter();
      console.timeEnd('dashboard:trainingCenter');
      const sections = {
        todoList,
        propertyAttractivity,
        savedSearchResults,
        followedPropertyNews,
        pastTransactions,
        p2pEstimation,
        p2pReport,
        trainingCenter,
        propertySearchPipeline,
        ownerPipeline,
      };

      const data = {
        user: { 
          id: user._id, 
          firstName: user.firstName || user.name || '',
          signupObjective: user.signupObjective || null,
        },
        meta: { generatedAt: new Date().toISOString(), period: req.query.period || 'day' },
        sections,
      };

      console.timeEnd('dashboard:TOTAL');
      cacheService.set(cacheKey, data, 300);
      return res.status(200).json({ success: true, data });
    } catch (err) {
      console.error('FrontendDashboardController.getOverview error', err);
      return res.status(500).json({ success: false, message: 'Failed to build dashboard overview', error: err?.message });
    }
  },

  getDashboardPreferences: async (req, res) => {
    try {
      const user = req.identity;
      if (!user) return res.status(401).json({ success: false, error: { code: 401, message: 'Authentication required.' } });

      const preferencesDoc = await db.dashboardPreferences.findOne({ userId: user._id }).lean();
      return res.status(200).json({ success: true, data: { preferences: preferencesDoc?.preferences || {} } });
    } catch (err) {
      console.error('FrontendDashboardController.getDashboardPreferences error', err);
      return res.status(500).json({ success: false, message: 'Failed to load dashboard preferences', error: err?.message });
    }
  },

  saveDashboardPreferences: async (req, res) => {
    try {
      const user = req.identity;
      if (!user) return res.status(401).json({ success: false, error: { code: 401, message: 'Authentication required.' } });

      const { mode, sectionOrder, sectionVisibility } = req.body;
      const allowedModes = ["buyer", "renter", "seller", "owner"];
      const allowedSections = [
        "todoList",
        "propertyAttractivity",
        "savedSearchResults",
        "followedPropertyNews",
        "pastTransactions",
        "p2pEstimation",
        "p2pReport",
        "trainingCenter",
        "propertySearchPipeline",
        "ownerPipeline",
      ];
      if (!allowedModes.includes(mode)) {
        return res.status(400).json({ success: false, message: 'Invalid dashboard mode.' });
      }
      if (!Array.isArray(sectionOrder) || sectionOrder.length !== allowedSections.length) {
        return res.status(400).json({ success: false, message: 'Invalid section order.' });
      }
      const sanitizedOrder = sectionOrder.filter((section) => allowedSections.includes(section));
      if (sanitizedOrder.length !== allowedSections.length) {
        return res.status(400).json({ success: false, message: 'Invalid section order values.' });
      }
      const sanitizedVisibility = {};
      if (typeof sectionVisibility === 'object' && sectionVisibility !== null) {
        allowedSections.forEach((section) => {
          sanitizedVisibility[section] = sectionVisibility[section] !== false;
        });
      } else {
        return res.status(400).json({ success: false, message: 'Invalid section visibility.' });
      }

      const update = {
        preferences: {
          [mode]: {
            sectionOrder: sanitizedOrder,
            sectionVisibility: sanitizedVisibility,
          },
        },
      };

      const preferencesDoc = await db.dashboardPreferences.findOneAndUpdate(
        { userId: user._id },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ success: true, data: { preferences: preferencesDoc.preferences } });
    } catch (err) {
      console.error('FrontendDashboardController.saveDashboardPreferences error', err);
      return res.status(500).json({ success: false, message: 'Failed to save dashboard preferences', error: err?.message });
    }
  },
};
