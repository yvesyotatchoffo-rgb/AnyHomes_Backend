const db = require('../models');
const Onboarding = db.onboarding;
const mongoose = require('mongoose');

const DEFAULT = {
  profile: 'owner',
  objective: 'sell',
  completions: {},
  completionCelebrationSeen: false,
};

// Map persisted signupObjective (French labels) to onboarding profile/objective
const SIGNUP_OBJECTIVE_MAP = {
  Acheter: { profile: 'searcher', objective: 'active_buy' },
  Louer: { profile: 'searcher', objective: 'active_rent' },
  'Planifier mon projet': { profile: 'searcher', objective: 'passive' },
  'Opportunités hors marché': { profile: 'searcher', objective: 'active_buy' },
  'Vendre ma propriété': { profile: 'owner', objective: 'sell' },
  'Louer ma propriété': { profile: 'owner', objective: 'rent' },
  'Évaluer ma propriété': { profile: 'owner', objective: 'increase_value' },
  'Préparer une vente future': { profile: 'owner', objective: 'sell' },
};

// Normalise legacy 'buyer' profile (stored before the 'searcher' rename) to 'searcher'.
const normaliseProfile = (profile) => (profile === 'buyer' ? 'searcher' : profile);

const ONBOARDING_ACTIONS_BY_CONFIG = {
  owner_sell: [
    'put_property_for_sale',
    'estimate_property_value',
    'consult_transaction_history',
    'get_targeted_help',
    'learn_real_estate',
    'build_seller_dossier',
    'build_visit_dossier',
    'get_personalized_advice',
    'peer_estimation',
  ],
  owner_rent: [
    'put_property_for_rent',
    'estimate_property_value',
    'get_targeted_help',
    'learn_real_estate',
    'get_personalized_advice',
    'peer_estimation',
    'build_visit_dossier',
  ],
  owner_increase_value: [
    'publish_property_directory',
    'estimate_property_value',
    'learn_real_estate',
    'get_personalized_advice',
    'peer_estimation',
  ],
  searcher_active_buy: [
    'compute_financial_score_buy',
    'search_property_buy',
    'get_targeted_help',
    'learn_real_estate',
    'build_buyer_dossier',
    'get_personalized_advice',
    'peer_estimation',
    'find_professional',
  ],
  searcher_active_rent: [
    'compute_financial_score_rent',
    'search_property_rent',
    'get_targeted_help',
    'learn_real_estate',
    'build_tenant_dossier',
    'get_personalized_advice',
    'peer_estimation',
    'find_professional',
  ],
  searcher_passive: [
    'compute_financial_score_passive',
    'browse_property_directory',
    'publish_property_directory',
    'learn_real_estate',
    'get_personalized_advice',
    'peer_estimation',
    'follow_property',
    'contact_owner_agency',
  ],
};

const getActionsForConfig = (profile, objective) => {
  const key = `${profile}_${objective}`;
  return ONBOARDING_ACTIONS_BY_CONFIG[key] || [];
};

const computeCompletionPercent = (profile, objective, completions = {}) => {
  const actions = getActionsForConfig(profile, objective);
  if (!actions.length) return 0;
  const done = actions.filter((id) => completions[id] === 'done').length;
  return Math.round((done / actions.length) * 100);
};

module.exports = {
  getState: async (req, res) => {
    try {
      const userId = req.identity?.id || req.query.userId;
      console.log('[ONBOARDING.getState] userId:', userId, 'type:', typeof userId, 'isObjectId:', mongoose.Types.ObjectId.isValid(userId));
      if (!userId) return res.status(200).json({ success: true, data: DEFAULT });

      if (!mongoose.isValidObjectId(userId)) return res.status(200).json({ success: true, data: DEFAULT });

      let rec = await Onboarding.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      if (!rec) {
        // Try to prefill from user's signupObjective when available (first-time)
        try {
          const Users = db.users;
          const user = await Users.findById(userId).lean();
          if (user && user.signupObjective) {
            const mapped = SIGNUP_OBJECTIVE_MAP[user.signupObjective];
            if (mapped) {
              const uid = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
              const created = await Onboarding.create({ userId: uid, profile: mapped.profile, objective: mapped.objective, completions: {} });
              return res.status(200).json({ success: true, data: { ...created.toObject ? created.toObject() : created, profile: normaliseProfile(created.profile) } });
            }
          }
        } catch (e) {
          console.error('Onboarding.prefill error', e);
        }
        return res.status(200).json({ success: true, data: DEFAULT });
      }
      
      // Auto-complete 'publish_property_directory' if user has any directory property
      try {
        const directoryPropertiesCount = await db.property.countDocuments({
          addedBy: new mongoose.Types.ObjectId(userId),
          propertyType: 'directory'
        });
        if (directoryPropertiesCount > 0) {
          const completions = { ...(rec.completions || {}) };
          completions['publish_property_directory'] = 'done';
          rec = { ...rec, completions };
        }
      } catch (e) {
        console.error('Onboarding.getState property check error', e);
      }

      // Auto-complete 'put_property_for_sale' if user has any sale property
      try {
        const salePropertiesCount = await db.property.countDocuments({
          addedBy: new mongoose.Types.ObjectId(userId),
          propertyType: 'sale'
        });
        if (salePropertiesCount > 0) {
          const completions = { ...(rec.completions || {}) };
          completions['put_property_for_sale'] = 'done';
          rec = { ...rec, completions };
        }
      } catch (e) {
        console.error('Onboarding.getState sale check error', e);
      }

      // Auto-complete 'put_property_for_rent' if user has any rent property
      try {
        const rentPropertiesCount = await db.property.countDocuments({
          addedBy: new mongoose.Types.ObjectId(userId),
          propertyType: 'rent'
        });
        if (rentPropertiesCount > 0) {
          const completions = { ...(rec.completions || {}) };
          completions['put_property_for_rent'] = 'done';
          rec = { ...rec, completions };
        }
      } catch (e) {
        console.error('Onboarding.getState rent check error', e);
      }
      
      // Auto-complete 'follow_property' if user is following any property
      try {
        const followedPropertiesCount = await db.followUnfollow.countDocuments({
          user_id: new mongoose.Types.ObjectId(userId),
          follow_unfollow: true
        });
        if (followedPropertiesCount > 0) {
          const completions = { ...(rec.completions || {}) };
          completions['follow_property'] = 'done';
          rec = { ...rec, completions };
        }
      } catch (e) {
        console.error('Onboarding.getState follow check error', e);
      }

      // Auto-complete 'contact_owner' if user has initiated a property chat
      try {
        const contactCount = await db.roommembers.countDocuments({
          user_id: new mongoose.Types.ObjectId(userId),
          property_id: { $exists: true }
        });
        if (contactCount > 0) {
          const completions = { ...(rec.completions || {}) };
          completions['contact_owner_agency'] = 'done';
          rec = { ...rec, completions };
        }
      } catch (e) {
        console.error('Onboarding.getState contact check error', e);
      }
      
      // Normalise legacy 'buyer' → 'searcher' for clients without a DB migration
      return res.status(200).json({ success: true, data: { ...rec, profile: normaliseProfile(rec.profile) } });
    } catch (err) {
      console.error('Onboarding.getState', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateProfile: async (req, res) => {
    try {
      const userId = req.identity?.id || req.body.userId;
      const { profile, objective } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

      const uid = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      const existing = await Onboarding.findOne({ userId: uid }).lean();
      const setConfiguredAt = !existing || !existing.configuredAt;
      const update = { $set: { profile, objective, ...(setConfiguredAt ? { configuredAt: new Date() } : {}) } };
      const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
      await Onboarding.findOneAndUpdate({ userId: uid }, update, opts);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Onboarding.updateProfile', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  updateObjective: async (req, res) => {
    try {
      const userId = req.identity?.id || req.body.userId;
      const { objective } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
      const uid2 = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      await Onboarding.findOneAndUpdate({ userId: uid2 }, { objective }, { upsert: true, new: true });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Onboarding.updateObjective', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  sendEvent: async (req, res) => {
    try {
      const userId = req.identity?.id || req.body.userId;
      const { eventType } = req.body;
      if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

      // Map of events -> onboarding actions (mirror frontend mapping)
      const EVENT_TO_ACTIONS = {
        property_published_sale:       ['put_property_for_sale'],
        property_published_rent:       ['put_property_for_rent'],
        property_published_directory:  ['publish_property_directory'],
        p2p_campaign_started:          ['estimate_property_value'],
        transaction_history_searched:  ['consult_transaction_history'],
        training_content_viewed:       ['learn_real_estate'],
        seller_dossier_document_added: ['build_seller_dossier'],
        buyer_dossier_document_added:  ['build_buyer_dossier'],
        tenant_dossier_document_added: ['build_tenant_dossier'],
        peer_estimation_submitted:     ['peer_estimation'],
        property_searched_sale:        ['search_property_buy'],
        property_searched_rent:        ['search_property_rent'],
        directory_browsed:             ['browse_property_directory'],
        professional_searched:         ['find_professional'],
        property_followed:             ['follow_property'],
        owner_contacted:               ['contact_owner_agency'],
        financial_score_calculated:    ['compute_financial_score_buy', 'compute_financial_score_rent', 'compute_financial_score_passive'],
        service_searched:               ['get_targeted_help'],
        coach_interacted:               ['get_personalized_advice'],
        visit_dossier_created:           ['build_visit_dossier'],
      };

      const toComplete = EVENT_TO_ACTIONS[eventType] || [];
      const uid = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;

      let rec = await Onboarding.findOne({ userId: uid });
      if (!rec) {
        // Determine profile from user's signupObjective when possible, default to 'owner'
        let defaultProfile = 'owner';
        let defaultObjective = 'sell';
        try {
          const Users = db.users;
          const user = await Users.findById(uid).lean();
          if (user && user.signupObjective) {
            const mapped = SIGNUP_OBJECTIVE_MAP[user.signupObjective];
            if (mapped) { defaultProfile = mapped.profile; defaultObjective = mapped.objective; }
          }
        } catch { /* non-blocking */ }
        rec = await Onboarding.create({ userId: uid, profile: defaultProfile, objective: defaultObjective, completions: {} });
      }

      const completions = { ...(rec.completions || {}) };
      toComplete.forEach((id) => { completions[id] = 'done'; });

      rec.completions = completions;
      await rec.save();

      return res.status(200).json({ success: true, data: rec });
    } catch (err) {
      console.error('Onboarding.sendEvent', err);
      return res.status(500).json({ success: false, message: err.message });
    }
    },

    getAdminList: async (req, res) => {
      try {
        let { search, sortBy, page = 1, count = 20 } = req.query;
        const query = { isDeleted: false, role: 'user' };

        if (search) {
          query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { city: { $regex: search, $options: 'i' } },
            { state: { $regex: search, $options: 'i' } },
            { country: { $regex: search, $options: 'i' } },
          ];
        }

        let sortquery = { createdAt: -1 };
        if (sortBy) {
          const [field, order] = sortBy.split(' ');
          sortquery = { [field || 'createdAt']: order === 'desc' ? -1 : 1 };
        }

        const pipeline = [
          { $match: query },
          {
            $lookup: {
              from: 'onboardings',
              localField: '_id',
              foreignField: 'userId',
              as: 'onboarding',
            },
          },
          {
            $unwind: {
              path: '$onboarding',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              id: '$_id',
              email: '$email',
              fullName: '$fullName',
              city: '$city',
              state: '$state',
              country: '$country',
              address: '$address',
              role: '$role',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt',
              profile: {
                $ifNull: ['$onboarding.profile', DEFAULT.profile],
              },
              objective: {
                $ifNull: ['$onboarding.objective', DEFAULT.objective],
              },
              completions: {
                $ifNull: ['$onboarding.completions', DEFAULT.completions],
              },
            },
          },
          { $sort: sortquery },
        ];

        const total = await db.users.countDocuments(query);
        const skipNo = (Number(page) - 1) * Number(count);
        pipeline.push({ $skip: skipNo }, { $limit: Number(count) });

        const result = await db.users.aggregate(pipeline);
        const data = result.map((item) => ({
          ...item,
          completionPercent: computeCompletionPercent(item.profile, item.objective, item.completions),
        }));

        return res.status(200).json({ success: true, data, total });
      } catch (err) {
        console.error('Onboarding.getAdminList', err);
        return res.status(500).json({ success: false, message: err.message });
      }
    },

    getAdminDetail: async (req, res) => {
      try {
        const id = req.query.id;
        if (!id) {
          return res.status(400).json({ success: false, message: 'id required' });
        }

        const user = await db.users.findById(id).lean();
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        let onboarding = await Onboarding.findOne({ userId: id }).lean();
        if (!onboarding) {
          const mapped = user.signupObjective ? SIGNUP_OBJECTIVE_MAP[user.signupObjective] : null;
          onboarding = mapped ? { profile: mapped.profile, objective: mapped.objective, completions: {} } : { ...DEFAULT };
        }

        const data = {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          city: user.city,
          state: user.state,
          country: user.country,
          address: user.address,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          profile: onboarding.profile || DEFAULT.profile,
          objective: onboarding.objective || DEFAULT.objective,
          completions: onboarding.completions || DEFAULT.completions,
          completionPercent: computeCompletionPercent(onboarding.profile || DEFAULT.profile, onboarding.objective || DEFAULT.objective, onboarding.completions || DEFAULT.completions),
        };

        return res.status(200).json({ success: true, data });
      } catch (err) {
        console.error('Onboarding.getAdminDetail', err);
        return res.status(500).json({ success: false, message: err.message });
      }      },

    markCelebrationSeen: async (req, res) => {
      try {
        const userId = req.identity?.id || req.body.userId;
        if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
        const uid = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        await Onboarding.findOneAndUpdate(
          { userId: uid },
          { $set: { completionCelebrationSeen: true } },
          { upsert: true, new: true }
        );
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Onboarding.markCelebrationSeen', err);
        return res.status(500).json({ success: false, message: err.message });
      }
    },

    markExplainerDone: async (req, res) => {
      try {
        const userId = req.identity?.id || req.body.userId;
        const { type } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: 'userId required' });
        if (!type || !['sidebar', 'dashboard', 'transactionOwner', 'transactionSearcher'].includes(type)) {
          return res.status(400).json({ success: false, message: 'type must be sidebar, dashboard, transactionOwner or transactionSearcher' });
        }
        const fieldMap = {
          sidebar: 'explainerSidebarDone',
          dashboard: 'explainerDashboardDone',
          transactionOwner: 'explainerTransactionOwnerDone',
          transactionSearcher: 'explainerTransactionSearcherDone',
        };
        const field = fieldMap[type];
        const uid = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        await Onboarding.findOneAndUpdate(
          { userId: uid },
          { $set: { [field]: true } },
          { upsert: true, new: true }
        );
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Onboarding.markExplainerDone', err);
        return res.status(500).json({ success: false, message: err.message });
      }
    },
    };