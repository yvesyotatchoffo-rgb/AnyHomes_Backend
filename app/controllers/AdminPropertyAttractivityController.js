/**
 * Admin – Property Attractivity
 * Provides:
 *   GET /admin/property-attractivity/activity-summary   – per-type counts
 *   GET /admin/property-attractivity/activity-logs      – paginated logs
 *   GET /admin/property-attractivity/index              – all properties with Attractivity Index
 */
const db = require("../models");

// ─── helpers ────────────────────────────────────────────────────────────────

/** Normalise x by cap (p95 proxy). Returns 0-1 float. */
const norm = (x, cap) => (cap > 0 ? Math.min(x / cap, 1) : 0);

/**
 * Compute Attractivity Index (0-100 %) for a single property.
 *
 * Formula:
 *   raw = Σ(wᵢ × norm(signalᵢ, capᵢ))
 *   age_factor = 1 + 0.1 × e^(-age_days / 30)   [fresh-property bonus, ≤10 %]
 *   index = min(raw × age_factor, 1) × 100
 *
 * Weights  (total = 1.0):
 *   views 0.20 | likes 0.18 | follows 0.17 | offers 0.20
 *   shares 0.10 | visit_requests 0.08 | messages 0.05 | avg_duration 0.02
 */
const computeIndex = (signals, caps, createdAt) => {
  const WEIGHTS = {
    views: 0.20,
    likes: 0.18,
    follows: 0.17,
    offers: 0.20,
    shares: 0.10,
    visit_requests: 0.08,
    messages: 0.05,
    avg_duration: 0.02,
  };

  let raw = 0;
  for (const [key, w] of Object.entries(WEIGHTS)) {
    raw += w * norm(signals[key] || 0, caps[key] || 1);
  }

  const ageDays = Math.max(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
    1
  );
  const ageFactor = 1 + 0.1 * Math.exp(-ageDays / 30);
  return Math.min(raw * ageFactor, 1) * 100;
};

// ─── controllers ────────────────────────────────────────────────────────────

module.exports = {

  /**
   * GET /admin/property-attractivity/activity-summary
   * Returns total counts per event type across all properties.
   * Like / follow counts come from their authoritative collections.
   */
  activitySummary: async (req, res) => {
    try {
      // Counts from propertyActivityLog (all types except like/follow)
      const rows = await db.propertyActivityLog.aggregate([
        { $group: { _id: "$type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const summary = {};
      for (const r of rows) summary[r._id] = r.count;

      // Overwrite like/follow/offer_sent with authoritative source counts
      const [likeCount, followCount, offerCount] = await Promise.all([
        db.favorites.countDocuments({ like: true, isDeleted: false }),
        db.followUnfollow.countDocuments({ follow_unfollow: true, isDeleted: false }),
        db.interests.countDocuments({ isDeleted: false }),
      ]);
      summary.like = likeCount;
      summary.follow = followCount;
      summary.offer_sent = offerCount;

      // Ensure all display types are present
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
   * Paginated list of activity entries.
   * For type=like  → queries favorites collection
   * For type=follow → queries followunfollows collection
   * Otherwise      → queries propertyActivityLog
   */
  activityLogs: async (req, res) => {
    try {
      const { type, propertyId, userId, page = 1, count = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(count);

      // ── Like tab → favorites ───────────────────────────────────────────
      if (type === "like") {
        const q = { like: true, isDeleted: false };
        if (propertyId) q.property_id = propertyId;
        if (userId) q.user_id = userId;

        const [total, rows] = await Promise.all([
          db.favorites.countDocuments(q),
          db.favorites
            .find(q)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(count))
            .populate("user_id", "firstName lastName fullName image email")
            .populate("property_id", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy")
            .lean(),
        ]);

        const data = rows.map((r) => ({
          _id: r._id,
          type: "like",
          createdAt: r.createdAt,
          userId: r.user_id,
          propertyId: r.property_id,
          duration: null,
          sectionVisited: null,
          phoneRevealed: null,
        }));
        return res.status(200).json({ success: true, total, data });
      }

      // ── Follow tab → followunfollows ───────────────────────────────────
      if (type === "follow") {
        const q = { follow_unfollow: true, isDeleted: false };
        if (propertyId) q.property_id = propertyId;
        if (userId) q.user_id = userId;

        const [total, rows] = await Promise.all([
          db.followUnfollow.countDocuments(q),
          db.followUnfollow
            .find(q)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(count))
            .populate("user_id", "firstName lastName fullName image email")
            .populate("property_id", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy")
            .lean(),
        ]);

        const data = rows.map((r) => ({
          _id: r._id,
          type: "follow",
          createdAt: r.createdAt,
          userId: r.user_id,
          propertyId: r.property_id,
          duration: null,
          sectionVisited: null,
          phoneRevealed: null,
        }));
        return res.status(200).json({ success: true, total, data });
      }

      // ── Offer/Interest tab → interests collection ──────────────────────
      if (type === "offer_sent") {
        const q = { isDeleted: false };
        if (propertyId) q.propertyId = propertyId;
        if (userId) q.buyerId = userId;

        const [total, rows] = await Promise.all([
          db.interests.countDocuments(q),
          db.interests
            .find(q)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(count))
            .populate("buyerId", "firstName lastName fullName image email")
            .populate("propertyId", "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy")
            .lean(),
        ]);

        const data = rows.map((r) => ({
          _id: r._id,
          type: "offer_sent",
          createdAt: r.createdAt,
          userId: r.buyerId,
          propertyId: r.propertyId,
          label: r.interestType || r.funnelStatus,
          makeOfferAmount: r.makeOfferAmount,
          funnelStatus: r.funnelStatus,
          duration: null,
          sectionVisited: null,
          phoneRevealed: null,
        }));
        return res.status(200).json({ success: true, total, data });
      }

      // ── All other types → propertyActivityLog ─────────────────────────
      const query = {};
      if (type) query.type = type;
      if (propertyId) query.propertyId = propertyId;
      if (userId) query.userId = userId;

      const [total, logs] = await Promise.all([
        db.propertyActivityLog.countDocuments(query),
        db.propertyActivityLog
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(count))
          .populate("userId", "firstName lastName fullName image email")
          .populate(
            "propertyId",
            "propertyTitle address zipcode city images propertyType price propertyMonthlyCharges status addedBy"
          )
          .lean(),
      ]);

      return res.status(200).json({ success: true, total, data: logs });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /admin/property-attractivity/index
   * Returns all properties with computed Attractivity Index.
   *
   * Query params:
   *   search       – property title / address / zipcode
   *   status       – active | deactive
   *   propertyType – sale | rent | offmarket
   *   page         – default 1
   *   count        – default 20
   *   sortBy       – attractivityIndex_desc (default) | attractivityIndex_asc | createdAt_desc
   */
  attractivityIndex: async (req, res) => {
    try {
      const {
        search,
        status,
        propertyType,
        page = 1,
        count = 20,
        sortBy = "attractivityIndex_desc",
      } = req.query;

      // ── Build property filter ──────────────────────────────────────────
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

      // ── Fetch all matching properties (no limit yet — need to rank by index) ─
      const properties = await db.property
        .find(filter)
        .select(
          "_id propertyTitle address zipcode city status propertyType price propertyMonthlyCharges surface images addedBy createdAt"
        )
        .populate("addedBy", "firstName lastName fullName image email")
        .lean();

      if (!properties.length) {
        return res.status(200).json({ success: true, total: 0, data: [] });
      }

      const propertyIds = properties.map((p) => p._id);

      // ── Aggregate signals per property ────────────────────────────────
      const signalRows = await db.propertyActivityLog.aggregate([
        { $match: { propertyId: { $in: propertyIds } } },
        {
          $group: {
            _id: "$propertyId",
            views: {
              $sum: { $cond: [{ $eq: ["$type", "profile_view"] }, 1, 0] },
            },
            likes: {
              $sum: { $cond: [{ $eq: ["$type", "like"] }, 1, 0] },
            },
            follows: {
              $sum: { $cond: [{ $eq: ["$type", "follow"] }, 1, 0] },
            },
            shares: {
              $sum: { $cond: [{ $eq: ["$type", "share"] }, 1, 0] },
            },
            offers: {
              $sum: { $cond: [{ $eq: ["$type", "offer_sent"] }, 1, 0] },
            },
            visit_requests: {
              $sum: { $cond: [{ $eq: ["$type", "visit_request"] }, 1, 0] },
            },
            messages: {
              $sum: { $cond: [{ $eq: ["$type", "contact_owner"] }, 1, 0] },
            },
            // avg duration for profile views that have a duration
            avg_duration: {
              $avg: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$type", "profile_view"] },
                      { $gt: ["$duration", 0] },
                    ],
                  },
                  "$duration",
                  null,
                ],
              },
            },
          },
        },
      ]);

      // map by propertyId
      const signalMap = {};
      for (const row of signalRows) {
        signalMap[String(row._id)] = row;
      }

      // ── Compute 95th-percentile caps across this dataset ─────────────
      const allSignals = properties.map((p) => {
        const s = signalMap[String(p._id)] || {};
        return {
          views: s.views || 0,
          likes: s.likes || 0,
          follows: s.follows || 0,
          shares: s.shares || 0,
          offers: s.offers || 0,
          visit_requests: s.visit_requests || 0,
          messages: s.messages || 0,
          avg_duration: s.avg_duration || 0,
        };
      });

      const p95 = (arr, key) => {
        const sorted = [...arr].map((a) => a[key]).sort((a, b) => a - b);
        const idx = Math.ceil(sorted.length * 0.95) - 1;
        return sorted[Math.max(0, idx)] || 1;
      };

      const caps = {
        views: p95(allSignals, "views"),
        likes: p95(allSignals, "likes"),
        follows: p95(allSignals, "follows"),
        shares: p95(allSignals, "shares"),
        offers: p95(allSignals, "offers"),
        visit_requests: p95(allSignals, "visit_requests"),
        messages: p95(allSignals, "messages"),
        avg_duration: p95(allSignals, "avg_duration"),
      };

      // ── Build result with index ────────────────────────────────────────
      const withIndex = properties.map((p) => {
        const s = signalMap[String(p._id)] || {};
        const signals = {
          views: s.views || 0,
          likes: s.likes || 0,
          follows: s.follows || 0,
          shares: s.shares || 0,
          offers: s.offers || 0,
          visit_requests: s.visit_requests || 0,
          messages: s.messages || 0,
          avg_duration: s.avg_duration || 0,
        };
        const ageDays = Math.max(
          (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          1
        );
        return {
          ...p,
          signals,
          ageDays: Math.round(ageDays),
          attractivityIndex: Math.round(computeIndex(signals, caps, p.createdAt) * 10) / 10,
        };
      });

      // ── Sort ──────────────────────────────────────────────────────────
      if (sortBy === "attractivityIndex_asc") {
        withIndex.sort((a, b) => a.attractivityIndex - b.attractivityIndex);
      } else if (sortBy === "createdAt_desc") {
        withIndex.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        // default: attractivityIndex_desc
        withIndex.sort((a, b) => b.attractivityIndex - a.attractivityIndex);
      }

      // ── Paginate ──────────────────────────────────────────────────────
      const total = withIndex.length;
      const skip = (Number(page) - 1) * Number(count);
      const paginated = withIndex.slice(skip, skip + Number(count));

      return res.status(200).json({ success: true, total, data: paginated, caps });
    } catch (err) {
      console.error("[attractivityIndex]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
