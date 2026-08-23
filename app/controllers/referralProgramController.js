const db = require("../models");
const mongoose = require("mongoose");
const ReferralService = require("../services/referral.service");

const Users = db.users;
const ReferralCode = db.referralCodes;
const Referral = db.referrals;
const ReferralCommission = db.referralCommissions;
const ReferralPayout = db.referralPayouts;

const toObjectId = (id) =>
  mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : id;

/**
 * Vérifie si l'utilisateur est en marque blanche (programme de parrainage désactivé).
 */
const isWhiteLabelUser = (user) => Boolean(user?.whiteLabelAgencyId);

module.exports = {
  /**
   * GET /referral-program/me
   * Code, URL, stats, filleuls, commissions, payouts du parrain connecté.
   */
  getMe: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }
      if (isWhiteLabelUser(user)) {
        return res.status(403).json({ success: false, message: "Programme non disponible en marque blanche." });
      }

      const codeDoc = await ReferralService.createReferralCodeForUser(user._id, user.firstName || user.fullName || "USER");
      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";
      const referralUrl = `${baseUrl}/signup?ref=${codeDoc.code}`;

      const [referrals, commissions, payouts] = await Promise.all([
        Referral.find({ sponsorUserId: user._id })
          .populate("referredUserId", "email firstName lastName fullName createdAt accountType")
          .sort({ createdAt: -1 })
          .lean(),
        ReferralCommission.find({ sponsorUserId: user._id }).sort({ createdAt: -1 }).lean(),
        ReferralPayout.find({ sponsorUserId: user._id }).sort({ createdAt: -1 }).lean(),
      ]);

      const totalReferredUsers = referrals.length;
      const activeReferredUsers = referrals.filter((r) => r.status === "active").length;
      const pendingCommissionsCents = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.commissionAmountCents, 0);
      const approvedCommissionsCents = commissions.filter((c) => c.status === "approved").reduce((s, c) => s + c.commissionAmountCents, 0);
      const totalPayoutsCents = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.totalAmountCents, 0);

      return res.json({
        success: true,
        data: {
          code: codeDoc.code,
          referralUrl,
          isCodeActive: codeDoc.isActive,
          connectStatus: {
            accountId: user.stripeConnectAccountId || null,
            active: Boolean(user.stripeConnectActive),
          },
          stats: {
            totalReferredUsers,
            activeReferredUsers,
            pendingCommissionsCents,
            approvedCommissionsCents,
            totalPayoutsCents,
          },
          referredUsers: referrals.map((r) => ({
            id: r._id,
            status: r.status,
            type: r.referredUserType,
            attributedAt: r.attributedAt,
            rewardEndsByType: r.rewardEndsByType,
            referredUser: r.referredUserId
              ? {
                  id: r.referredUserId._id,
                  email: r.referredUserId.email,
                  firstName: r.referredUserId.firstName,
                  lastName: r.referredUserId.lastName,
                  fullName: r.referredUserId.fullName,
                  accountType: r.referredUserId.accountType,
                }
              : null,
          })),
          commissions: commissions.map((c) => ({
            id: c._id,
            revenueType: c.revenueType,
            baseAmountHtCents: c.baseAmountHtCents,
            commissionRate: c.commissionRate,
            commissionAmountCents: c.commissionAmountCents,
            status: c.status,
            eligibleAt: c.eligibleAt,
            approvedAt: c.approvedAt,
            paidAt: c.paidAt,
            createdAt: c.createdAt,
          })),
          payouts: payouts.map((p) => ({
            id: p._id,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
            totalAmountCents: p.totalAmountCents,
            status: p.status,
            payoutMethod: p.payoutMethod,
            providerTransferId: p.provider?.transferId || null,
            paidAt: p.paidAt,
            createdAt: p.createdAt,
          })),
        },
      });
    } catch (err) {
      console.error("[ReferralProgramController.getMe]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /referral-program/signup
   * Attribue un parrain à un nouveau compte (utilisé si le ref n'a pas été
   * traité au register, ex. inscription sociale ou complétion de profil).
   */
  signup: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }
      if (isWhiteLabelUser(user)) {
        return res.status(403).json({ success: false, message: "Programme non disponible en marque blanche." });
      }

      const { referralCode, attributionSource } = req.body;
      if (!referralCode) {
        return res.status(400).json({ success: false, message: "referralCode requis." });
      }

      const userType = user.accountType === "pro" ? "pro" : "particulier";
      const referral = await ReferralService.attachReferralOnSignup(
        user._id,
        referralCode,
        userType,
        attributionSource === "manual_code" ? "manual_code" : "url"
      );

      if (!referral) {
        return res.status(400).json({ success: false, message: "Code de parrainage invalide." });
      }

      return res.json({ success: true, data: { referralId: referral._id } });
    } catch (err) {
      console.error("[ReferralProgramController.signup]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * GET /referral-program/code/info?code=XXX
   * Infos publiques d'un code (prénom du parrain) pour l'écran d'inscription.
   */
  getCodeInfo: async (req, res) => {
    try {
      const code = String(req.query.code || "").toUpperCase().trim();
      if (!code) {
        return res.status(400).json({ success: false, message: "code requis." });
      }

      const codeDoc = await ReferralCode.findOne({ code, isActive: true })
        .populate("userId", "firstName lastName fullName")
        .lean();
      if (!codeDoc || !codeDoc.userId) {
        return res.status(404).json({ success: false, message: "Code invalide." });
      }

      return res.json({
        success: true,
        data: {
          code: codeDoc.code,
          sponsorFirstname: codeDoc.userId.firstName || codeDoc.userId.fullName || "Un membre",
        },
      });
    } catch (err) {
      console.error("[ReferralProgramController.getCodeInfo]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },

  /**
   * POST /referral-program/connect/link
   * Crée (si besoin) le compte Stripe Connect du parrain et renvoie le lien d'onboarding.
   */
  getConnectOnboardingLink: async (req, res) => {
    try {
      const user = req.identity;
      if (!user || req.isGuest) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
      }

      const stripeService = require("../modules/services-marketplace/services/stripeMarketplaceService");
      let accountId = user.stripeConnectAccountId;
      if (!accountId) {
        const account = await stripeService.createConnectAccount({
          email: user.email,
          name: user.fullName || user.firstName || "AnyHomes",
        });
        accountId = account.id;
        await Users.updateOne(
          { _id: user._id },
          { $set: { stripeConnectAccountId: accountId } }
        );
      }

      const baseUrl = process.env.APP_FRONTEND_URL || "http://localhost:8089";
      const refreshUrl = `${baseUrl}/invite?connect=refresh`;
      const returnUrl = `${baseUrl}/invite?connect=return`;
      const link = await stripeService.createOnboardingLink(accountId, refreshUrl, returnUrl);

      return res.json({ success: true, data: { url: link.url } });
    } catch (err) {
      console.error("[ReferralProgramController.getConnectOnboardingLink]", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
};
