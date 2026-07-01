const mongoose = require("mongoose");
const db = require("../models");

const ReferralAdminController = {
  /**
   * GET /api/admin/referrals/overview
   * Statistiques globales du programme de parrainage
   */
  async getOverview(req, res) {
    try {
      const referralInvitations = db.referralInvitations;
      const users = db.users;

      const now = new Date();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

      // Statistiques globales
      const [
        totalInvitations,
        totalSent,
        totalOpened,
        totalSignedUp,
        totalActivated,
        totalSuspicious,
        usersWithShareCode,
        usersInvited,
        channelStats,
        statusDistribution,
        last7Days,
        last30Days,
      ] = await Promise.all([
        referralInvitations.countDocuments(),
        referralInvitations.countDocuments({ status: "sent" }),
        referralInvitations.countDocuments({ status: "opened" }),
        referralInvitations.countDocuments({ status: "signed_up" }),
        referralInvitations.countDocuments({ status: "activated" }),
        referralInvitations.countDocuments({ "metadata.suspicious": true }),
        users.countDocuments({ shareCode: { $exists: true, $ne: null } }),
        users.countDocuments({ invitedByUserId: { $exists: true, $ne: null } }),

        // Par canal
        referralInvitations.aggregate([
          {
            $group: {
              _id: "$channel",
              count: { $sum: 1 },
              signedUp: {
                $sum: { $cond: [{ $eq: ["$status", "signed_up"] }, 1, 0] },
              },
            },
          },
        ]),

        // Par statut
        referralInvitations.aggregate([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Derniers 7 jours
        referralInvitations.countDocuments({
          createdAt: { $gte: sevenDaysAgo },
        }),

        // Derniers 30 jours
        referralInvitations.countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
        }),
      ]);

      // Calcul des taux
      const conversionRate = totalSent > 0 ? ((totalSignedUp / totalSent) * 100).toFixed(2) : 0;
      const activationRate = totalSignedUp > 0 ? ((totalActivated / totalSignedUp) * 100).toFixed(2) : 0;

      return res.json({
        success: true,
        data: {
          period: {
            now: new Date().toISOString(),
            sevenDaysAgo: sevenDaysAgo.toISOString(),
            thirtyDaysAgo: thirtyDaysAgo.toISOString(),
          },
          totals: {
            invitations: totalInvitations,
            sent: totalSent,
            opened: totalOpened,
            signedUp: totalSignedUp,
            activated: totalActivated,
            suspicious: totalSuspicious,
          },
          users: {
            withShareCode: usersWithShareCode,
            invited: usersInvited,
          },
          rates: {
            conversion: `${conversionRate}%`,
            activation: `${activationRate}%`,
          },
          trends: {
            last7Days,
            last30Days,
          },
          byChannel: channelStats,
          byStatus: statusDistribution,
        },
      });
    } catch (error) {
      console.error("Error fetching referral overview:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/invitations
   * Liste des invitations avec filtres et infos du user
   */
  async getInvitations(req, res) {
    try {
      // db already imported at top
      const referralInvitations = db.referralInvitations;

      const {
        status,
        channel,
        source,
        suspicious,
        page = 1,
        limit = 50,
        sortBy = "-createdAt",
      } = req.query;

      let filter = {};
      if (status) filter.status = status;
      if (channel) filter.channel = channel;
      if (source) {
        // "toast" est un filtre générique pour toutes les sources toast-*
        filter.source = source === "toast"
          ? { $regex: /^toast-/ }
          : source;
      }
      if (suspicious === "true") filter["metadata.suspicious"] = true;
      if (suspicious === "false") filter["metadata.suspicious"] = { $ne: true };

      const skip = (page - 1) * limit;
      const sortObj = {};
      const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy;
      sortObj[sortField] = sortBy.startsWith('-') ? -1 : 1;

      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "users",
            localField: "inviterUserId",
            foreignField: "_id",
            as: "inviter",
          },
        },
        { $unwind: { path: "$inviter", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "metadata.invitedUserId",
            foreignField: "_id",
            as: "invitedUser",
          },
        },
        { $unwind: { path: "$invitedUser", preserveNullAndEmptyArrays: true } },
        { $sort: sortObj },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1,
            shareCode: 1,
            channel: 1,
            source: 1,
            status: 1,
            createdAt: 1,
            openedAt: 1,
            signedUpAt: 1,
            activatedAt: 1,
            inviter: {
              _id: "$inviter._id",
              email: "$inviter.email",
              firstName: "$inviter.firstName",
              lastName: "$inviter.lastName",
              phone: "$inviter.phone",
            },
            personalMessage: 1,
            invitedUser: {
              _id: "$invitedUser._id",
              email: "$invitedUser.email",
              firstName: "$invitedUser.firstName",
              lastName: "$invitedUser.lastName",
            },
          },
        },
      ];

      const [invitations, totalResult] = await Promise.all([
        referralInvitations.aggregate(pipeline),
        referralInvitations.countDocuments(filter),
      ]);

      return res.json({
        success: true,
        data: {
          invitations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalResult,
            pages: Math.ceil(totalResult / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/:id
   * Détails d'une invitation
   */
  async getInvitationDetail(req, res) {
    try {
      // db already imported at top
      const { id } = req.params;

      const invitation = await db.referralInvitations.findById(id);

      if (!invitation) {
        return res.status(404).json({ success: false, error: "Invitation not found" });
      }

      const inviter = await db.users.findById(invitation.inviterUserId);
      const invitedUser =
        invitation.invitedUserId && mongoose.Types.ObjectId.isValid(invitation.invitedUserId)
          ? await db.users.findById(invitation.invitedUserId)
          : null;

      return res.json({
        success: true,
        data: {
          invitation,
          inviter: inviter
            ? {
                id: inviter._id,
                email: inviter.email,
                firstName: inviter.firstName,
                lastName: inviter.lastName,
              }
            : null,
          invitedUser: invitedUser
            ? {
                id: invitedUser._id,
                email: invitedUser.email,
                firstName: invitedUser.firstName,
                lastName: invitedUser.lastName,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("Error fetching invitation detail:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/admin/referrals/:id/mark-invalid
   * Marquer une invitation comme invalide
   */
  async markInvalid(req, res) {
    try {
      // db already imported at top
      const { id } = req.params;
      const { reason } = req.body;

      const invitation = await db.referralInvitations.findByIdAndUpdate(
        id,
        {
          status: "invalid",
          invalidatedAt: new Date(),
          rejectionReason: reason || "Marked as invalid by admin",
        },
        { new: true }
      );

      if (!invitation) {
        return res.status(404).json({ success: false, error: "Invitation not found" });
      }

      return res.json({ success: true, data: invitation });
    } catch (error) {
      console.error("Error marking invitation invalid:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/admin/referrals/:id/mark-rejected
   * Marquer une invitation comme rejetée (fraude)
   */
  async markRejected(req, res) {
    try {
      // db already imported at top
      const { id } = req.params;
      const { reason } = req.body;

      const invitation = await db.referralInvitations.findByIdAndUpdate(
        id,
        {
          status: "rejected",
          rejectionReason: reason || "Rejected by admin",
          "metadata.suspicious": true,
        },
        { new: true }
      );

      if (!invitation) {
        return res.status(404).json({ success: false, error: "Invitation not found" });
      }

      return res.json({ success: true, data: invitation });
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/analytics/funnel
   * Funnel d'activation du programme de parrainage
   */
  async getFunnel(req, res) {
    try {
      // db already imported at top
      const referralInvitations = db.referralInvitations;

      const funnel = await referralInvitations.aggregate([
        {
          $facet: {
            sent: [{ $match: { status: "sent" } }, { $count: "count" }],
            opened: [{ $match: { status: "opened" } }, { $count: "count" }],
            signedUp: [{ $match: { status: "signed_up" } }, { $count: "count" }],
            activated: [{ $match: { status: "activated" } }, { $count: "count" }],
          },
        },
      ]);

      const data = funnel[0];
      const sent = data.sent[0]?.count || 0;
      const opened = data.opened[0]?.count || 0;
      const signedUp = data.signedUp[0]?.count || 0;
      const activated = data.activated[0]?.count || 0;

      return res.json({
        success: true,
        data: {
          funnel: [
            { stage: "Sent", count: sent, percentage: 100 },
            { stage: "Opened", count: opened, percentage: sent > 0 ? ((opened / sent) * 100).toFixed(2) : 0 },
            {
              stage: "Signed Up",
              count: signedUp,
              percentage: sent > 0 ? ((signedUp / sent) * 100).toFixed(2) : 0,
            },
            {
              stage: "Activated",
              count: activated,
              percentage: signedUp > 0 ? ((activated / signedUp) * 100).toFixed(2) : 0,
            },
          ],
        },
      });
    } catch (error) {
      console.error("Error fetching funnel:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/analytics/by-channel
   * Performance par canal de partage
   */
  async getAnalyticsByChannel(req, res) {
    try {
      // db already imported at top
      const referralInvitations = db.referralInvitations;

      const stats = await referralInvitations.aggregate([
        {
          $group: {
            _id: "$channel",
            total: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $eq: ["$status", "opened"] }, 1, 0] } },
            signedUp: { $sum: { $cond: [{ $eq: ["$status", "signed_up"] }, 1, 0] } },
            activated: { $sum: { $cond: [{ $eq: ["$status", "activated"] }, 1, 0] } },
            suspicious: { $sum: { $cond: [{ $eq: ["$metadata.suspicious", true] }, 1, 0] } },
          },
        },
        {
          $project: {
            channel: "$_id",
            _id: 0,
            total: 1,
            sent: 1,
            opened: 1,
            signedUp: 1,
            activated: 1,
            suspicious: 1,
            conversionRate: { $cond: [{ $gt: ["$sent", 0] }, { $divide: [{ $multiply: ["$signedUp", 100] }, "$sent"] }, 0] },
            activationRate: {
              $cond: [{ $gt: ["$signedUp", 0] }, { $divide: [{ $multiply: ["$activated", 100] }, "$signedUp"] }, 0],
            },
          },
        },
      ]);

      return res.json({ success: true, data: stats });
    } catch (error) {
      console.error("Error fetching channel analytics:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/inviters
   * Liste des users ayant envoyé au moins une invitation, avec leurs stats
   */
  async getInviters(req, res) {
    try {
      const referralInvitations = db.referralInvitations;
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      const pipeline = [
        {
          $group: {
            _id: "$inviterUserId",
            totalInvitations: { $sum: 1 },
            convertedInvitations: {
              $sum: {
                $cond: [{ $in: ["$status", ["signed_up", "activated"]] }, 1, 0],
              },
            },
            lastInvitationDate: { $max: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { totalInvitations: -1, lastInvitationDate: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1,
            totalInvitations: 1,
            convertedInvitations: 1,
            lastInvitationDate: 1,
            user: {
              _id: "$user._id",
              firstName: "$user.firstName",
              lastName: "$user.lastName",
              email: "$user.email",
              mobileNo: "$user.mobileNo",
              city: "$user.city",
              pinCode: "$user.pinCode",
            },
          },
        },
      ];

      const [inviters, totalResult] = await Promise.all([
        referralInvitations.aggregate(pipeline),
        referralInvitations.distinct("inviterUserId"),
      ]);

      return res.json({
        success: true,
        data: {
          inviters,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalResult.length,
            pages: Math.ceil(totalResult.length / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching inviters:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/invitees
   * Liste des users inscrits via une invitation
   */
  async getInvitees(req, res) {
    try {
      const users = db.users;
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      const pipeline = [
        { $match: { invitedByUserId: { $exists: true, $ne: null } } },
        {
          $lookup: {
            from: "users",
            localField: "invitedByUserId",
            foreignField: "_id",
            as: "inviter",
          },
        },
        { $unwind: { path: "$inviter", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            mobileNo: 1,
            city: 1,
            signupObjective: 1,
            createdAt: 1,
            inviter: {
              _id: "$inviter._id",
              firstName: "$inviter.firstName",
              lastName: "$inviter.lastName",
            },
          },
        },
      ];

      const [invitees, total] = await Promise.all([
        users.aggregate(pipeline),
        users.countDocuments({ invitedByUserId: { $exists: true, $ne: null } }),
      ]);

      return res.json({
        success: true,
        data: {
          invitees,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching invitees:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/admin/referrals/suspicious
   * Liste des cas suspects (fraude potentielle)
   */
  async getSuspicious(req, res) {
    try {
      // db already imported at top
      const { page = 1, limit = 50 } = req.query;
      const skip = (page - 1) * limit;

      const pipeline = [
        { $match: { "metadata.suspicious": true } },
        {
          $lookup: {
            from: "users",
            localField: "inviterUserId",
            foreignField: "_id",
            as: "inviter",
          },
        },
        { $unwind: { path: "$inviter", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "metadata.invitedUserId",
            foreignField: "_id",
            as: "invitedUser",
          },
        },
        { $unwind: { path: "$invitedUser", preserveNullAndEmptyArrays: true } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            _id: 1,
            shareCode: 1,
            channel: 1,
            source: 1,
            status: 1,
            createdAt: 1,
            rejectionReason: 1,
            inviter: {
              _id: "$inviter._id",
              email: "$inviter.email",
              firstName: "$inviter.firstName",
              lastName: "$inviter.lastName",
            },
            invitedUser: {
              _id: "$invitedUser._id",
              email: "$invitedUser.email",
              firstName: "$invitedUser.firstName",
              lastName: "$invitedUser.lastName",
            },
            metadata: 1,
          },
        },
      ];

      const [suspicious, totalResult] = await Promise.all([
        db.referralInvitations.aggregate(pipeline),
        db.referralInvitations.countDocuments({ "metadata.suspicious": true }),
      ]);

      return res.json({
        success: true,
        data: {
          suspicious,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalResult,
            pages: Math.ceil(totalResult / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching suspicious invitations:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  },
};

module.exports = ReferralAdminController;
