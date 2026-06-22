const db = require('../models');

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
      route: '/training',
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
      route: '/training',
    },
  ],
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
            trainingCenter: mockTrainingCenter,
            propertySearchPipeline: mockPropertySearchPipeline,
            ownerPipeline: mockOwnerPipeline,
          },
        };

        return res.status(200).json({ success: true, data });
      }

      // --- propertyAttractivity: latest properties owned by user ---
      const properties = await db.property.find({ addedBy: userId, isDeleted: false }).sort({ createdAt: -1 }).lean();
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

      // --- savedSearchResults: user's saved searches ---
      const savedSearches = await db.savesearch.find({ searchBy: userId }).sort({ createdAt: -1 }).lean();
      const savedSearchResults = {
        visible: true,
        emptyState: savedSearches.length === 0 ? { message: 'Aucun saved search', ctaLabel: 'Nouvelle recherche', ctaRoute: '/properties' } : null,
        _isMock: savedSearches.length === 0,
        cards: savedSearches.length > 0 ? await Promise.all(savedSearches.map(async (s) => {
          // For previewProperties, pick up to 5 matching properties (best-effort)
          const qs = { isDeleted: false };
          if (s.propertyType) qs.propertyType = s.propertyType;
          if (s.zipcode) qs.zipcode = s.zipcode;
          const preview = await db.property.find(qs).limit(5).lean();
          return {
            savedSearchId: s._id,
            name: s.searchLocation || `${s.propertyType || ''} ${s.zipcode || ''}`,
            criteriaLabel: `${s.propertyType || 'Tout'}${s.searchLocation ? ' • ' + s.searchLocation : ''}`,
            newResultsCount: s.searchByCount || 0,
            previewProperties: preview.map(p => ({ id: p._id, coverUrl: resolvePropertyCoverUrl(p.images) || defaultCover, route: `/property-details?id=${p._id}` })),
            action: { route: `/properties?searchId=${s._id}` },
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

      // --- todoList: simple heuristics based on user role / properties ---
      const todos = [];
      if (properties.length > 0) {
        // If user is owner, suggest to send seller file or open visit slots
        // No limit - all properties are included, frontend handles pagination
        properties.forEach((p, idx) => {
          todos.push({
            id: `todo-prop-${p._id}`,
            type: 'SEND_SELLER_FILE',
            label: `Mettre à jour le dossier de ${p.propertyTitle || p.title || 'votre bien'}`,
            role: 'OWNER',
            priority: idx + 1,
            createdAt: p.createdAt,
            property: { id: p._id, coverUrl: resolvePropertyCoverUrl(p.images) || defaultCover, type: p.type || '', surface: p.surface || 0, city: p.city || '' },
            action: { route: `/seller-file?propertyId=${p._id}` },
          });
        });

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

        // --- Card 2: Saved searches with new results ---
        try {
          const savedSearches = await db.savesearch.find({ searchBy: userId }).lean();
          
          for (const search of savedSearches.slice(0, 3)) {
            if (search.searchByCount > 0) {
              todos.push({
                id: `todo-search-${search._id}`,
                type: 'NEW_SEARCH_RESULTS',
                label: 'Consultez les nouveaux biens référencés',
                role: 'BUYER',
                priority: properties.length + savedSearches.indexOf(search) + 1,
                createdAt: search.updatedAt || search.createdAt,
                searchInfo: {
                  searchId: search._id,
                  location: search.searchLocation || search.zipcode || 'Votre région',
                  newResultsCount: search.searchByCount || 0,
                },
                action: { route: `/properties?searchId=${search._id}` },
              });
            }
          }
        } catch (err) {
          console.error('Error fetching saved searches for dashboard:', err);
        }

        // --- Card 3: Services pending confirmation ---
        try {
          const pendingServices = await db.payments.find({
            userId: userId,
            paymentStatus: 'successfull',
            status: 'active',
            isDeleted: false
          }).select('planId amount createdAt').lean();

          for (const service of pendingServices.slice(0, 2)) {
            const plan = await db.plans.findById(service.planId).select('name').lean();
            if (plan) {
              todos.push({
                id: `todo-service-${service._id}`,
                type: 'CONFIRM_SERVICE',
                label: 'Confirmez la réalisation du service',
                role: 'OWNER',
                priority: properties.length + pendingServices.indexOf(service) + 1,
                createdAt: service.createdAt,
                serviceInfo: {
                  serviceId: service._id,
                  serviceName: plan.name || 'Service acheté',
                },
                action: { route: `/marketplace/orders?serviceId=${service._id}` },
              });
            }
          }
        } catch (err) {
          console.error('Error fetching pending services for dashboard:', err);
        }

        // Sort todos by createdAt (most recent first)
        todos.sort((a, b) => {
          const dateA = a.createdAt || new Date(0);
          const dateB = b.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA);
        });
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

      const todoList = {
        visible: true,
        title: 'Votre ToDo Liste',
        subtitle: 'Actions pour faire avancer votre projet immobilier',
        emptyMessage: 'Vous retrouverez ici les actions à mener pour faire avancer votre projet immobilier',
        _isMock: properties.length === 0,
        items: todos,
      };

      const sections = {
        todoList,
        propertyAttractivity,
        savedSearchResults,
        followedPropertyNews: mockFollowedPropertyNews,
        pastTransactions: mockPastTransactions,
        p2pEstimation: mockP2PEstimation,
        p2pReport: mockP2PReport,
        trainingCenter: mockTrainingCenter,
        propertySearchPipeline: mockPropertySearchPipeline,
        ownerPipeline: mockOwnerPipeline,
      };

      const data = {
        user: { id: user._id, firstName: user.firstName || user.name || '' },
        meta: { generatedAt: new Date().toISOString(), period: req.query.period || 'day' },
        sections,
      };

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
