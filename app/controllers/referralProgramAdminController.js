const db = require("../models");
const mongoose = require("mongoose");
const ReferralService = require("../services/referral.service");

const Referral = db.referrals;
const ReferralCode = db.referralCodes;
const ReferralCommission = db.referralCommissions;
const ReferralPayout = db.referralPayouts;
const ReferralProgramSetting = db.referralProgramSettings;
const Users = db.users;

const toObjectId = (id) =>
  mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;

const isAdmin = (user) => user && (user.role === "admin" || user.role === "staff" || user.isAdmin === true);

module.exports = {
  /**
   * GET /api/admin/referral-program/referrals
   * Liste des rattachements avec filtres + pagination.
   */
  listReferrals: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { status, referredUserType, sponsorUserId, referredUserId, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (referredUserType) filter.referredUserType = referredUserType;
      if (sponsorUserId) filter.sponsorUserId = toObjectId(sponsorUserId);
      if (referredUserId) filter.referredUserId = toObjectId(referredUserId);

      const skip = (Number(page) - 1) * Number(limit);
      const [referrals, total] = await Promise.all([
        Referral.find(filter)
          .populate("sponsorUserId", "email firstName lastName fullName accountType")
          .populate("referredUserId", "email firstName lastName fullName accountType")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Referral.countDocuments(filter),
      ]);

      return res.json({ success: true, data: referrals, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error("[ReferralAdmin.listReferrals]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/referrals/:id/block
   * Bloque un rattachement.
   */
  blockReferral: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const referral = await Referral.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "blocked", blockedReason: req.body?.reason || "Bloqué par l'admin" } },
        { new: true }
      );
      if (!referral) return res.status(404).json({ success: false, message: "Rattachement introuvable." });

      return res.json({ success: true, data: referral });
    } catch (err) {
      console.error("[ReferralAdmin.blockReferral]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/referrals/:id/unblock
   */
  unblockReferral: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const referral = await Referral.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "active", blockedReason: null } },
        { new: true }
      );
      if (!referral) return res.status(404).json({ success: false, message: "Rattachement introuvable." });

      return res.json({ success: true, data: referral });
    } catch (err) {
      console.error("[ReferralAdmin.unblockReferral]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /api/admin/referral-program/commissions
   * Liste des commissions avec filtres + pagination.
   */
  listCommissions: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { status, revenueType, sponsorUserId, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (revenueType) filter.revenueType = revenueType;
      if (sponsorUserId) filter.sponsorUserId = toObjectId(sponsorUserId);

      const skip = (Number(page) - 1) * Number(limit);
      const [commissions, total] = await Promise.all([
        ReferralCommission.find(filter)
          .populate("sponsorUserId", "email firstName lastName fullName")
          .populate("referredUserId", "email firstName lastName fullName")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        ReferralCommission.countDocuments(filter),
      ]);

      return res.json({ success: true, data: commissions, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error("[ReferralAdmin.listCommissions]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/commissions/:id/reject
   */
  rejectCommission: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const commission = await ReferralCommission.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "rejected", rejectionReason: req.body?.reason || "Rejeté par l'admin" } },
        { new: true }
      );
      if (!commission) return res.status(404).json({ success: false, message: "Commission introuvable." });

      return res.json({ success: true, data: commission });
    } catch (err) {
      console.error("[ReferralAdmin.rejectCommission]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/commissions/:id/approve
   */
  approveCommission: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const commission = await ReferralCommission.findByIdAndUpdate(
        req.params.id,
        { $set: { status: "approved", approvedAt: new Date() } },
        { new: true }
      );
      if (!commission) return res.status(404).json({ success: false, message: "Commission introuvable." });

      return res.json({ success: true, data: commission });
    } catch (err) {
      console.error("[ReferralAdmin.approveCommission]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /api/admin/referral-program/codes
   */
  listCodes: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { isActive, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (isActive !== undefined) filter.isActive = isActive === "true";

      const skip = (Number(page) - 1) * Number(limit);
      const [codes, total] = await Promise.all([
        ReferralCode.find(filter)
          .populate("userId", "email firstName lastName fullName")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        ReferralCode.countDocuments(filter),
      ]);

      return res.json({ success: true, data: codes, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error("[ReferralAdmin.listCodes]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/codes/:id/disable
   */
  disableCode: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const code = await ReferralCode.findByIdAndUpdate(
        req.params.id,
        { $set: { isActive: false, disabledReason: req.body?.reason || "Désactivé par l'admin" } },
        { new: true }
      );
      if (!code) return res.status(404).json({ success: false, message: "Code introuvable." });

      return res.json({ success: true, data: code });
    } catch (err) {
      console.error("[ReferralAdmin.disableCode]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/settings
   * Crée une nouvelle version des paramètres (et désactive l'ancienne).
   */
  createProgramSetting: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const {
        commissionRates,
        rewardDurationsMonths,
        validationDelayDays,
        minimumPayoutAmountCents,
        maxCommissionPerReferredUserCents,
        maxCommissionPerSponsorPerMonthCents,
        notes,
      } = req.body;

      const last = await ReferralProgramSetting.findOne().sort({ version: -1 }).lean();
      const version = (last?.version || 0) + 1;

      // Désactive l'actuelle
      await ReferralProgramSetting.updateMany({ isActive: true }, { $set: { isActive: false } });

      const setting = await ReferralProgramSetting.create({
        version,
        isActive: true,
        effectiveFrom: new Date(),
        commissionRates: commissionRates || { particulierService: 0.1, proService: 0.1, proSubscription: 0.15 },
        rewardDurationsMonths: rewardDurationsMonths || { particulierService: 6, proService: 6, proSubscription: 12 },
        validationDelayDays: validationDelayDays ?? 14,
        minimumPayoutAmountCents: minimumPayoutAmountCents ?? 5000,
        maxCommissionPerReferredUserCents: maxCommissionPerReferredUserCents ?? null,
        maxCommissionPerSponsorPerMonthCents: maxCommissionPerSponsorPerMonthCents ?? null,
        createdByUserId: user._id,
        notes: notes || null,
      });

      return res.json({ success: true, data: setting });
    } catch (err) {
      console.error("[ReferralAdmin.createProgramSetting]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /api/admin/referral-program/settings
   */
  listProgramSettings: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const settings = await ReferralProgramSetting.find().sort({ version: -1 }).lean();
      return res.json({ success: true, data: settings });
    } catch (err) {
      console.error("[ReferralAdmin.listProgramSettings]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /api/admin/referral-program/payouts
   */
  listPayouts: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const { status, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [payouts, total] = await Promise.all([
        ReferralPayout.find(filter)
          .populate("sponsorUserId", "email firstName lastName fullName")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        ReferralPayout.countDocuments(filter),
      ]);

      return res.json({ success: true, data: payouts, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error("[ReferralAdmin.listPayouts]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /api/admin/referral-program/payouts/:id/retry
   */
  retryPayout: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const payout = await ReferralService.transferPayout(req.params.id);
      return res.json({ success: true, data: payout });
    } catch (err) {
      console.error("[ReferralAdmin.retryPayout]", err);
      return res.status(500).json({ success: false, message: err.message || "Erreur serveur." });
    }
  },

  /**
   * GET /api/admin/referral-program/overview
   * KPIs globaux pour le back-office.
   */
  overview: async (req, res) => {
    try {
      const user = req.identity;
      if (!isAdmin(user)) return res.status(403).json({ success: false, message: "Accès refusé." });

      const [totalReferrals, totalCommissions, totalPending, totalApproved, totalPaid, totalPayouts, totalCodes] = await Promise.all([
        Referral.countDocuments(),
        ReferralCommission.countDocuments(),
        ReferralCommission.aggregate([{ $match: { status: "pending" } }, { $group: { _id: null, total: { $sum: "$commissionAmountCents" } } }]),
        ReferralCommission.aggregate([{ $match: { status: "approved" } }, { $group: { _id: null, total: { $sum: "$commissionAmountCents" } } }]),
        ReferralCommission.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$commissionAmountCents" } } }]),
        ReferralPayout.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, total: { $sum: "$totalAmountCents" } } }]),
        ReferralCode.countDocuments(),
      ]);

      return res.json({
        success: true,
        data: {
          totalReferrals,
          totalCommissions,
          pendingCommissionsCents: totalPending[0]?.total || 0,
          approvedCommissionsCents: totalApproved[0]?.total || 0,
          paidCommissionsCents: totalPaid[0]?.total || 0,
          totalPayoutsCents: totalPayouts[0]?.total || 0,
          totalCodes,
        },
      });
    } catch (err) {
      console.error("[ReferralAdmin.overview]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
};
