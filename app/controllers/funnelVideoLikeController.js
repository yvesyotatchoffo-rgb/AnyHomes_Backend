"use strict";
var mongoose = require("mongoose");
const db = require("../models");

module.exports = {
  likeDislike: async (req, res) => {
    try {
      const { funnelUrlId, addedBy } = req.body;

      if (!funnelUrlId || !addedBy) {
        return res.status(400).json({
          success: false,
          message: "Required fields missing."
        });
      }

      const existingLike = await db.funnelVideoLike.findOne({
        funnelUrlId,
        addedBy
      });

      if (existingLike) {
        await db.funnelVideoLike.deleteOne({ _id: existingLike._id });
        return res.status(200).json({
          success: true,
          message: "Like removed."
        });
      }

      await db.funnelVideoLike.create({ funnelUrlId, addedBy });
      return res.status(200).json({
        success: true,
        message: "Funnel Video liked."
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },

  viewCount: async (req, res) => {
    const { funnelUrlId } = req.body;
    const viewerId = req.identity.id;
    console.log("FUNNEL USER", funnelUrlId);
    console.log("USER", req.identity.id);
    if (!funnelUrlId || !viewerId) {
      return res.status(400).json({
        success: false,
        message: "Missing funnelUrlId or viewerId."
      });
    }

    const funnel = await db.funnelUrl.findById(funnelUrlId);
    if (!funnel) {
      return res.status(404).json({
        success: false,
        message: "Funnel URL not found."
      });
    }

    const hasViewed = req.isGuest ? false : funnel.viewersId.includes(viewerId);
    if (!hasViewed) {
      if (!req.isGuest) {
        funnel.viewersId.push(viewerId);
      }
      funnel.viewCount = (funnel.viewCount || 0) + 1;
      await funnel.save();
    }

    return res.status(200).json({
      success: true,
      message: hasViewed ? "View already recorded." : "View recorded successfully.",
      viewCount: funnel.viewCount
    });
  }
}