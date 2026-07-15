/**
 * Admin – Property Attractivity
 *
 * Score d'attractivité digitale (0-100) basé sur 3 sous-scores :
 *   Visibilité (20%), Engagement (30%), Intention (50%)
 *
 * Endpoints :
 *   GET /admin/property-attractivity/activity-summary
 *   GET /admin/property-attractivity/activity-logs
 *   GET /admin/property-attractivity/index
 */
const db = require("../models");
const mongoose = require("mongoose");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const norm = (x, cap) => (cap > 0 ? Math.min(x / cap, 1) : 0);

const p95 = (arr, key) => {
  const sorted = [...arr].map((a) => a[key]).sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(0, idx)] || 1;
};

/**
 * Calcule le score d'attractivité (0-100) selon la spec V1.
 *
 * 3 sous-scores :
 *   - Visibilité (poids 0.20) : views, avg_duration
 *   - Engagement (poids 0.30) : likes, shares, follows, avg_duration
 *   - Intention  (poids 0.50) : offers (intérêt explicite), messages, visit_requests
 *
 * Normalisation par le 95e percentile de la plateforme.
 * Bonus de fraîcheur : +10% max, décroissance exponentielle sur 30 jours.
 */
const computeScore = (signals, caps, createdAt) => {
  const SCHEMA = {
    visibility: {
      weight: 0.20,
      fields: ["views", "avg_duration"],
    },
    engagement: {
      weight: 0.30,
      fields: ["likes", "shares", "follows", "revisits"],
    },
    intent: {
      weight: 0.50,
      fields: ["offers", "messages", "visit_requests"],
    },
  };

  let global = 0;
  const subScores = {};

  for (const [key, group] of Object.entries(SCHEMA)) {
    let raw = 0;
    let count = 0;
    for (const field of group.fields) {
      const val = signals[field] || 0;
      const cap = caps[field] || 1;
      raw += norm(val, cap);
      count++;
    }
    subScores[key] = count > 0 ? (raw / count) * 100 : 0;
    global += group.weight * (subScores[key] / 100);
  }

  const ageDays = Math.max(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    1
  );
  const ageFactor = 1 + 0.1 * Math.exp(-ageDays / 30);
  const final = Math.min(global * ageFactor, 1) * 100;

  return {
    global: Math.round(final * 10) / 10,
    visibility: Math.round(subScores.visibility * 10) / 10,
    engagement: Math.round(subScores.engagement * 10) / 10,
    intent: Math.round(subScores.intent * 10) / 10,
  };
};

/**
 * Agrège les signaux d'attractivité pour un ensemble de propriétés.
 * Utilise des pipelines d'agrégation MongoDB groupés (pas de boucle N+1).
 */
async function aggregateSignals(propertyIds) {
  if (!propertyIds.length) return {};

  const ids = propertyIds.map((id) =>
    typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
  );

  // 1. Signaux depuis propertyActivityLog
  const logRows = await db.propertyActivityLog.aggregate([
    { $match: { propertyId: { $in: ids } } },
    {
      $group: {
        _id: "$propertyId",
        views: { $sum: { $cond: [{ $eq: ["$type", "profile_view"] }, 1, 0] } },
        shares: { $sum: { $cond: [{ $eq: ["$type", "share"] }, 1, 0] } },
        messages: { $sum: { $cond: [{ $eq: ["$type", "contact_owner"] }, 1, 0] } },
        visit_requests: { $sum: { $cond: [{ $eq: ["$type", "visit_request"] }, 1, 0] } },
        total_duration: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$type", "profile_view"] }, { $gt: ["$duration", 0] }] },
              "$duration", 0,
            ],
          },
        },
        view_count_for_duration: { $sum: { $cond: [{ $gt: ["$duration", 0] }, 1, 0] } },
      },
    },
  ]);

  const signalMap = {};
  for (const row of logRows) {
    signalMap[String(row._id)] = {
      views: row.views || 0,
      shares: row.shares || 0,
      messages: row.messages || 0,
      visit_requests: row.visit_requests || 0,
      revisits: 0,
      avg_duration: row.view_count_for_duration > 0
        ? row.total_duration / row.view_count_for_duration : 0,
    };
  }

  // 2. Likes via aggregation groupée sur favorites
  if (ids.length > 0) {
    const likeRows = await db.favorites.aggregate([
      { $match: { property_id: { $in: ids }, like: true, isDeleted: false } },
      { $group: { _id: "$property_id", count: { $sum: 1 } } },
    ]);
    for (const row of likeRows) {
      const sid = String(row._id);
      if (!signalMap[sid]) signalMap[sid] = {};
      signalMap[sid].likes = row.count;
    }
  }

  // 3. Follows via aggregation groupée sur followUnfollow
  if (ids.length > 0) {
    const followRows = await db.followUnfollow.aggregate([
      { $match: { property_id: { $in: ids }, follow_unfollow: true, isDeleted: false } },
      { $group: { _id: "$property_id", count: { $sum: 1 } } },
    ]);
    for (const row of followRows) {
      const sid = String(row._id);
      if (!signalMap[sid]) signalMap[sid] = {};
      signalMap[sid].follows = row.count;
    }
  }

  // 4. Intérêts via aggregation groupée sur interests
  if (ids.length > 0) {
    const offerRows = await db.interests.aggregate([
      { $match: { propertyId: { $in: ids }, isDeleted: false } },
      { $group: { _id: "$propertyId", count: { $sum: 1 } } },
    ]);
    for (const row of offerRows) {
      const sid = String(row._id);
      if (!signalMap[sid]) signalMap[sid] = {};
      signalMap[sid].offers = row.count;
    }
  }

  return signalMap;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

module.exports = {
  /**
   * GET /admin/property-attractivity/activity-summary
   */
  activitySummary: async (req, res) => {
    try {
      const rows = await db.propertyActivityLog.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const summary = {};
      for (const r of rows) summary[r._id] = r.count;

      const [likeCount, followCount, offerCount] = await Promise.all([
        db.favorites.countDocuments({ like: true, isDeleted: false }),
        db.followUnfollow.countDocuments({ follow_unfollow: true, isDeleted: false }),
        db.interests.countDocuments({ isDeleted: false }),
      ]);
      summary.like = likeCount;
      summary.follow = followCount;
      summary.offer_sent = offerCount;

      const defaultTypes = [
        "profile_view", "like", "unlike", "follow", "unfollow",
        "share", "contact_owner", "visit_request", "offer_sent",
      ];
      for (const t of defaultTypes) {
        if (!summary[t]) summary[t] = 0;
      }

      return res.status(200).json({ success: true, data: summary });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /admin/property-attractivity/activity-logs
   */
  activityLogs: async (req, res) => {
    try {
      const { type, propertyId, userId, page = 1, count = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(count);

      if (type === "like") {
        const q = { like: true, isDeleted: false };
        if (propertyId) q.property_id = propertyId;
        if (userId) q.user_id = userId;
        const [total, rows] = await Promise.all([
          db.favorites.countDocuments(q),
          db.favorites.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(count))
            .populate("user_id", "firstName lastName fullName image email")
            .populate("property_id", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy").lean(),
        ]);
        const data = rows.map((r) => ({ _id: r._id, type: "like", createdAt: r.createdAt, userId: r.user_id, propertyId: r.property_id }));
        return res.status(200).json({ success: true, total, data });
      }

      if (type === "follow") {
        const q = { follow_unfollow: true, isDeleted: false };
        if (propertyId) q.property_id = propertyId;
        if (userId) q.user_id = userId;
        const [total, rows] = await Promise.all([
          db.followUnfollow.countDocuments(q),
          db.followUnfollow.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(count))
            .populate("user_id", "firstName lastName fullName image email")
            .populate("property_id", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy").lean(),
        ]);
        const data = rows.map((r) => ({ _id: r._id, type: "follow", createdAt: r.createdAt, userId: r.user_id, propertyId: r.property_id }));
        return res.status(200).json({ success: true, total, data });
      }

      if (type === "offer_sent") {
        const q = { isDeleted: false };
        if (propertyId) q.propertyId = propertyId;
        if (userId) q.buyerId = userId;
        const [total, rows] = await Promise.all([
          db.interests.countDocuments(q),
          db.interests.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(count))
            .populate("buyerId", "firstName lastName fullName image email")
            .populate("propertyId", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy").lean(),
        ]);
        const data = rows.map((r) => ({ _id: r._id, type: "offer_sent", createdAt: r.createdAt, userId: r.buyerId, propertyId: r.propertyId, label: r.interestType || r.funnelStatus, makeOfferAmount: r.makeOfferAmount }));
        return res.status(200).json({ success: true, total, data });
      }

      const query = {};
      if (type) query.type = type;
      if (propertyId) query.propertyId = propertyId;
      if (userId) query.userId = userId;

      const [total, logs] = await Promise.all([
        db.propertyActivityLog.countDocuments(query),
        db.propertyActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(count))
          .populate("userId", "firstName lastName fullName image email")
          .populate("propertyId", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy").lean(),
      ]);

      return res.status(200).json({ success: true, total, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /admin/property-attractivity/index
   * Retourne tous les biens avec leur score d'attractivité calculé selon la spec V1.
   */
  attractivityIndex: async (req, res) => {
    try {
      const {
        search, status, propertyType,
        page = 1, count = 20,
        sortBy = "attractivityIndex_desc",
      } = req.query;

      // Filtre
      const filter = { isDeleted: false };
      if (status) filter.status = status;
      if (propertyType) filter.propertyType = propertyType;
      if (search) {
        filter.$or = [
          { propertyTitle: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
          { zipcode: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
        ];
      }

      // Compter le total (rapide — utilise l'index MongoDB)
      const total = await db.property.countDocuments(filter);
      if (total === 0) {
        return res.status(200).json({ success: true, total: 0, data: [] });
      }

      // Ne charger QUE la page demandée (pas les 392k biens)
      const skip = (Number(page) - 1) * Number(count);
      const properties = await db.property
        .find(filter)
        .select("_id propertyTitle address zipcode city status propertyType price propertyMonthlyCharges surface images addedBy createdAt lifecycleStatus")
        .populate("addedBy", "firstName lastName fullName image email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(count))
        .lean();

      if (!properties.length) {
        return res.status(200).json({ success: true, total: 0, data: [] });
      }

      const propertyIds = properties.map((p) => p._id);

      // Agrégation des signaux POUR LA PAGE UNIQUEMENT
      const signalMap = await aggregateSignals(propertyIds);

      // Caps calculés sur les biens de la page (approximation suffisante pour l'admin)
      const allSignals = properties.map((p) => {
        const s = signalMap[String(p._id)] || {};
        return {
          views: s.views || 0, likes: s.likes || 0, follows: s.follows || 0,
          shares: s.shares || 0, offers: s.offers || 0,
          visit_requests: s.visit_requests || 0, messages: s.messages || 0,
          avg_duration: s.avg_duration || 0, revisits: s.revisits || 0,
        };
      });

      const caps = {
        views: p95(allSignals, "views"), likes: p95(allSignals, "likes"),
        follows: p95(allSignals, "follows"), shares: p95(allSignals, "shares"),
        offers: p95(allSignals, "offers"), visit_requests: p95(allSignals, "visit_requests"),
        messages: p95(allSignals, "messages"), avg_duration: p95(allSignals, "avg_duration"),
        revisits: p95(allSignals, "revisits"),
      };

      // Calcul du score pour chaque bien de la page
      const withScore = properties.map((p) => {
        const s = signalMap[String(p._id)] || {};
        const signals = {
          views: s.views || 0, likes: s.likes || 0, follows: s.follows || 0,
          shares: s.shares || 0, offers: s.offers || 0,
          visit_requests: s.visit_requests || 0, messages: s.messages || 0,
          avg_duration: s.avg_duration || 0, revisits: s.revisits || 0,
        };
        const ageDays = Math.max(
          (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24), 1
        );
        const score = computeScore(signals, caps, p.createdAt);
        return {
          ...p, signals, ageDays: Math.round(ageDays),
          attractivityIndex: score.global,
          visibilityScore: score.visibility,
          engagementScore: score.engagement,
          intentScore: score.intent,
        };
      });

      // Tri local (dans les limites de la page)
      if (sortBy === "attractivityIndex_asc") {
        withScore.sort((a, b) => a.attractivityIndex - b.attractivityIndex);
      } else if (sortBy === "visibility_desc") {
        withScore.sort((a, b) => b.visibilityScore - a.visibilityScore);
      } else if (sortBy === "engagement_desc") {
        withScore.sort((a, b) => b.engagementScore - a.engagementScore);
      } else if (sortBy === "intent_desc") {
        withScore.sort((a, b) => b.intentScore - a.intentScore);
      } else {
        withScore.sort((a, b) => b.attractivityIndex - a.attractivityIndex);
      }

      return res.status(200).json({ success: true, total, data: withScore, caps });
    } catch (err) {
      console.error("[attractivityIndex]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
