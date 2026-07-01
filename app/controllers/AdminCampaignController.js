const db = require("../models");
const mongoose = require("mongoose");

const avg = (arr, field) => {
  const vals = arr.map((e) => e[field]).filter((v) => v != null && !isNaN(v));
  return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
};

/**
 * GET /admin/campaigns/estimation-stats
 * Stats globales sur les estimations (toutes, campaign ou non)
 */
exports.estimationStats = async (req, res) => {
  try {
    const [totalEstimations, distinctProperties, distinctEstimators] = await Promise.all([
      db.peerEstimation.countDocuments(),
      db.peerEstimation.distinct("propertyId"),
      db.peerEstimation.distinct("userId"),
    ]);
    return res.json({
      success: true,
      data: {
        totalEstimations,
        distinctProperties: distinctProperties.length,
        distinctEstimators: distinctEstimators.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur serveur", error: err.message });
  }
};

/**
 * GET /admin/campaigns/stats
 * Statistiques globales
 */
exports.stats = async (req, res) => {
  try {
    const [totalCampaigns, distinctProperties, distinctEstimators] = await Promise.all([
      db.peerCampaign.countDocuments(),
      db.peerCampaign.distinct("propertyId"),
      db.peerEstimation.distinct("userId"),
    ]);

    return res.json({
      success: true,
      data: {
        totalCampaigns,
        totalProperties: distinctProperties.length,
        totalEstimators: distinctEstimators.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur serveur", error: err.message });
  }
};

/**
 * GET /admin/campaigns
 * Liste paginée des campagnes avec estimation count + prix moyen
 */
exports.list = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const matchStage = {};
    if (status) matchStage.status = status;
    if (search) matchStage.campaignName = { $regex: search, $options: "i" };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "properties",
          localField: "propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "owner",
        },
      },
      { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "peerestimations",
          localField: "_id",
          foreignField: "campaginId",
          as: "estimations",
        },
      },
      {
        $addFields: {
          estimationCount: { $size: "$estimations" },
          avgPrice: {
            $cond: {
              if: { $gt: [{ $size: "$estimations" }, 0] },
              then: { $round: [{ $avg: "$estimations.userReasonablePrice" }, 0] },
              else: null,
            },
          },
        },
      },
      {
        $project: {
          estimations: 0,
          "owner.password": 0,
          "owner.token": 0,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: parseInt(limit) }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await db.peerCampaign.aggregate(pipeline);
    const data = result[0].data;
    const total = result[0].total[0]?.count || 0;

    return res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur serveur", error: err.message });
  }
};

/**
 * GET /admin/campaigns/:id
 * Détail d'une campagne + données consolidées + liste estimations
 */
exports.detail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "ID invalide" });
    }

    const campaign = await db.peerCampaign
      .findById(id)
      .populate("propertyId", "propertyTitle images city zipcode address price surface rooms")
      .populate("userId", "fullName email featuredProfilePhoto")
      .lean();

    if (!campaign) return res.status(404).json({ success: false, message: "Campagne introuvable" });

    const estimations = await db.peerEstimation
      .find({ campaginId: id })
      .populate("userId", "fullName firstName lastName email featuredProfilePhoto")
      .sort({ createdAt: -1 })
      .lean();

    const estimationCount = estimations.length;
    const avgPrice = estimationCount
      ? Math.round(estimations.reduce((s, e) => s + (e.userReasonablePrice || 0), 0) / estimationCount)
      : null;

    const perceptionCounts = { underestimated: 0, appropriate: 0, expensive: 0 };
    estimations.forEach((e) => {
      if (perceptionCounts[e.referencePrice] !== undefined) perceptionCounts[e.referencePrice]++;
    });
    const perceptionPct = {
      underestimated: estimationCount ? Math.round((perceptionCounts.underestimated / estimationCount) * 100) : 0,
      appropriate: estimationCount ? Math.round((perceptionCounts.appropriate / estimationCount) * 100) : 0,
      expensive: estimationCount ? Math.round((perceptionCounts.expensive / estimationCount) * 100) : 0,
    };

    // Price distribution buckets (10 equal buckets between min and max)
    let priceDistribution = [];
    if (estimationCount > 0) {
      const prices = estimations.map((e) => e.userReasonablePrice).filter(Boolean);
      if (prices.length > 1) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const bucketSize = Math.max(1, Math.round((maxP - minP) / 8));
        const buckets = {};
        prices.forEach((p) => {
          const bucket = Math.floor((p - minP) / bucketSize) * bucketSize + minP;
          buckets[bucket] = (buckets[bucket] || 0) + 1;
        });
        priceDistribution = Object.entries(buckets)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([price, count]) => ({ price: Number(price), count }));
      } else if (prices.length === 1) {
        priceDistribution = [{ price: prices[0], count: 1 }];
      }
    }

    const qualitative = {
      ratePropertyTitle: avg(estimations, "ratePropertyTitle"),
      ratePropertyPictures: avg(estimations, "ratePropertyPictures"),
      rateInteriorDesign: avg(estimations, "rateInteriorDesign"),
      rateLocation: avg(estimations, "rateLocation"),
      rateCouldYouLiveIn: avg(estimations, "rateCouldYouLiveIn"),
    };

    return res.json({
      success: true,
      data: {
        campaign,
        consolidated: { estimationCount, avgPrice, perceptionPct, priceDistribution, qualitative },
        estimations,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Erreur serveur", error: err.message });
  }
};
