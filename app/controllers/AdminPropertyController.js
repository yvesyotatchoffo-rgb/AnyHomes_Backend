"use strict";
const db = require("../models");
const mongoose = require("mongoose");
const logPropertyActivity = require("../services/propertyActivityLog.service");

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch (_) {
    return null;
  }
};

module.exports = {
  /**
   * GET /property/admin/detail/:id
   * Returns full property data + aggregated counts for admin view.
   */
  adminDetail: async (req, res) => {
    try {
      const propertyId = req.params.id || req.query.id;
      if (!propertyId || !mongoose.Types.ObjectId.isValid(String(propertyId))) {
        return res.status(400).json({ success: false, message: "Invalid propertyId" });
      }

      const property = await db.property
        .findOne({ _id: propertyId, isDeleted: false })
        .populate("amenities", "name type")
        .populate("equipment", "name type")
        .populate("outside", "name type")
        .populate("serviceAccessibility", "name type")
        .populate("ancilliary", "name type")
        .populate("environment", "name type")
        .populate("leisure", "name type")
        .populate("cooking", "name type")
        .populate("categories", "name")
        .populate("addedBy", "firstName lastName fullName email image _id")
        .populate("agency", "firstName lastName fullName email image _id")
        .populate("propertyState", "name")
        .populate("heatingType", "name")
        .populate("energymode", "name")
        .populate("like", "firstName lastName fullName email image _id createdAt")
        .populate("follow", "firstName lastName fullName email image _id createdAt")
        .populate({
          path: "renovation_work",
          populate: { path: "title", model: "revenueManagement", select: "name" },
        })
        .populate({
          path: "Expenses",
          populate: { path: "type", model: "revenueManagement", select: "name" },
        })
        .populate({
          path: "revenue_detail",
          populate: [
            { path: "type", model: "revenueManagement", select: "name" },
            { path: "source", model: "revenueManagement", select: "name" },
          ],
        })
        .populate({
          path: "rating",
          populate: { path: "type", model: "revenueManagement", select: "name" },
        })
        .populate("linkedSchools.schoolId", "EstablishmentName address city zipcode")
        .lean();

      if (!property) {
        return res.status(404).json({ success: false, message: "Property not found" });
      }

      const pid = toObjectId(propertyId);

      // Parallel aggregation - leads & activity only (like/follow already populated in property)
      const [leadCount, leads, contactCount, activityLogs] = await Promise.all([
        db.interests.countDocuments({ propertyId, isDeleted: false }),
        db.interests
          .find({ propertyId, isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(100)
          .populate("buyerId", "firstName lastName fullName email image _id")
          .lean(),
        db.contactUs.countDocuments({ property_id: pid }),
        db.propertyActivityLog
          .find({ propertyId })
          .sort({ createdAt: -1 })
          .limit(200)
          .populate("userId", "firstName lastName fullName email image _id")
          .lean(),
      ]);

      // Like and follow arrays are already populated in the property object
      const likers = (property.like || []).map((u) => ({ user_id: u, createdAt: new Date() }));
      const followers = (property.follow || []).map((u) => ({ user_id: u, createdAt: new Date() }));

      return res.status(200).json({
        success: true,
        data: {
          property,
          stats: {
            leadCount,
            followerCount: followers.length,
            likeCount: likers.length,
            contactCount,
            shareCount: property.shareCount || 0,
            viewCount: property.propertyViewerCount || 0,
            visitBookedCount: property.visitBookedCount || 0,
            activityIndicatorCount: property.activityIndicatorCount || 0,
          },
          leads,
          followers,
          likers,
          activityLogs,
        },
      });
    } catch (err) {
      console.error("[adminPropertyDetail]", err);
      return res.status(500).json({ success: false, message: err.message || "Server error" });
    }
  },

  /**
   * GET /property/admin/activity/:id
   * Returns paginated activity log for a property.
   */
  adminActivity: async (req, res) => {
    try {
      const propertyId = req.params.id || req.query.propertyId;
      if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        db.propertyActivityLog
          .find({ propertyId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("userId", "firstName lastName fullName email image _id")
          .lean(),
        db.propertyActivityLog.countDocuments({ propertyId }),
      ]);

      return res.status(200).json({ success: true, data: logs, total, page, limit });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
