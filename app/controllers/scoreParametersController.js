const db = require("../models");
const { handleServerError } = require("../utls/helper");
const { loadScoreParameters } = require("../services/financialScore.service");

module.exports = {
  getDetail: async (req, res) => {
    try {
      let settings = await db.scoreParameters.findOne({ status: "active" }).lean();
      if (!settings) {
        settings = await loadScoreParameters();
      }
      return res.status(200).json({ success: true, settings });
    } catch (err) {
      return handleServerError(res, err, "Score Parameters Details");
    }
  },

  addUpdate: async (req, res) => {
    try {
      const userId = req.identity?.id;
      const user = userId ? await db.users.findById(userId) : null;
      if (!user || user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Unauthorized." });
      }

      const payload = { ...req.body };
      if (payload.feesRate && typeof payload.feesRate === "object") {
        payload.feesRate = {
          ancien: payload.feesRate.ancien ?? payload.feesRate["ancien"],
          neuf: payload.feesRate.neuf ?? payload.feesRate["neuf"],
          venteSurPlan: payload.feesRate.venteSurPlan ?? payload.feesRate["vente sur plan"],
          construction: payload.feesRate.construction ?? payload.feesRate["construction"],
          terrainConstruction:
            payload.feesRate.terrainConstruction ?? payload.feesRate["terrain + construction"],
        };
      }

      if (payload.scoreBuckets && Array.isArray(payload.scoreBuckets)) {
        payload.scoreBuckets = payload.scoreBuckets
          .map((bucket) => ({
            min: Number(bucket.min) || 0,
            score: Number(bucket.score) || 0,
          }))
          .sort((a, b) => b.min - a.min);
      }

      let settings = await db.scoreParameters.findOne({ status: "active" });
      if (settings) {
        Object.assign(settings, payload);
        settings.addedBy = user._id;
        await settings.save();
        return res.status(200).json({ success: true, message: "Score parameters updated successfully", settings });
      }

      const newSettings = new db.scoreParameters({ ...payload, addedBy: user._id });
      await newSettings.save();
      return res.status(201).json({ success: true, message: "Score parameters created successfully", settings: newSettings });
    } catch (err) {
      return handleServerError(res, err, "Score Parameters");
    }
  },
};
