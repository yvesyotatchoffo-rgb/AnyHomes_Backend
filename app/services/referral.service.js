const db = require("../models");
const { generateReferralCode, addMonths, calculateCommissionCents, toCents } = require("../utils/referral");
const { sendEmail } = require("../config/brevo.config");
const constants = require("../utls/constants");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const ReferralCode = db.referralCodes;
const Referral = db.referrals;
const ReferralCommission = db.referralCommissions;
const ReferralPayout = db.referralPayouts;
const ReferralProgramSetting = db.referralProgramSettings;
const Users = db.users;

const REVENUE_TYPE_TO_DURATION_KEY = {
  particulier_service: "particulierService",
  pro_service: "proService",
  pro_subscription: "proSubscription",
};

const REVENUE_TYPE_TO_RATE_KEY = {
  particulier_service: "particulierService",
  pro_service: "proService",
  pro_subscription: "proSubscription",
};

class ReferralService {
  /**
   * Récupère le paramétrage actif du programme (version la plus récente active).
   */
  static async getActiveProgramSetting() {
    return ReferralProgramSetting.findOne({ isActive: true })
      .sort({ effectiveFrom: -1 })
      .lean();
  }

  /**
   * Crée le code de parrainage d'un utilisateur (idempotent).
   */
  static async createReferralCodeForUser(userId, userFirstname) {
    const existing = await ReferralCode.findOne({ userId });
    if (existing) return existing;

    let code, isUnique = false;
    while (!isUnique) {
      code = generateReferralCode(userFirstname);
      const existingCode = await ReferralCode.findOne({ code });
      if (!existingCode) isUnique = true;
    }
    return ReferralCode.create({ userId, code, isActive: true });
  }

  /**
   * Attache un parrain à un nouvel utilisateur lors de l'inscription.
   *
   * @param {string} userId               — id du nouveau compte (filleul)
   * @param {string} referralCodeStr      — code saisi / présent dans l'URL
   * @param {string} referredUserType     — 'particulier' | 'pro'
   * @param {string} attributionSource    — 'url' | 'manual_code'
   * @returns {Object|null} le rattachement créé, ou null si aucun code valide
   */
  static async attachReferralOnSignup(userId, referralCodeStr, referredUserType = "particulier", attributionSource = "url") {
    if (!referralCodeStr) return null;

    const activeSetting = await this.getActiveProgramSetting();
    if (!activeSetting) return null; // programme inactif ou non configuré

    const referralCodeDoc = await ReferralCode.findOne({
      code: String(referralCodeStr).toUpperCase().trim(),
      isActive: true,
    });
    if (!referralCodeDoc) return null;

    // Anti self-referral
    if (String(referralCodeDoc.userId) === String(userId)) return null;

    // Un filleul ne peut avoir qu'un seul parrain
    const existingReferral = await Referral.findOne({ referredUserId: userId });
    if (existingReferral) return existingReferral;

    const now = new Date();
    const duration = activeSetting.rewardDurationsMonths;

    const referral = await Referral.create({
      sponsorUserId: referralCodeDoc.userId,
      referredUserId: userId,
      referralCodeId: referralCodeDoc._id,
      referralCode: referralCodeDoc.code,
      referredUserType,
      attributionSource,
      attributedAt: now,
      rewardStartAt: now,
      rewardEndsByType: {
        particulierService: addMonths(now, duration.particulierService),
        proService: addMonths(now, duration.proService),
        proSubscription: addMonths(now, duration.proSubscription),
      },
      status: "active",
      programSnapshot: {
        programVersion: activeSetting.version,
        commissionRates: {
          particulierService: activeSetting.commissionRates.particulierService,
          proService: activeSetting.commissionRates.proService,
          proSubscription: activeSetting.commissionRates.proSubscription,
        },
        rewardDurationsMonths: {
          particulierService: duration.particulierService,
          proService: duration.proService,
          proSubscription: duration.proSubscription,
        },
        validationDelayDays: activeSetting.validationDelayDays,
        maxCommissionPerReferredUserCents: activeSetting.maxCommissionPerReferredUserCents,
        maxCommissionPerSponsorPerMonthCents: activeSetting.maxCommissionPerSponsorPerMonthCents,
      },
    });

    // Email au parrain : son filleul vient de créer un compte
    try {
      const sponsor = await Users.findById(referralCodeDoc.userId).select("email firstName lastName fullName").lean();
      const godson = await Users.findById(userId).select("email firstName lastName fullName").lean();
      if (sponsor?.email) {
        sendEmail({
          to: sponsor.email,
          templateId: constants.BREVO.REFERRAL_NEW_GODSON,
          params: {
            sponsorFirstName: sponsor.firstName || sponsor.fullName || "",
            godsonEmail: godson?.email || "",
            referralCode: referralCodeDoc.code,
          },
        }).catch((err) => console.error("[ReferralService] REFERRAL_NEW_GODSON error:", err));
      }
    } catch (e) {
      console.error("[ReferralService] godson email error:", e);
    }

    return referral;
  }

  /**
   * Vérifie les plafonds (par filleul, et par parrain/mois).
   * Retourne le montant effectif (éventuellement plafonné) en centimes.
   */
  static async applyCommissionCaps({ sponsorUserId, referredUserId, revenueType, amountCents, snapshot }) {
    let capped = amountCents;

    const maxPerReferred = snapshot?.maxCommissionPerReferredUserCents;
    if (maxPerReferred != null) {
      const alreadyPerReferred = await ReferralCommission.aggregate([
        { $match: { sponsorUserId, referredUserId, status: { $in: ["pending", "approved", "paid"] } } },
        { $group: { _id: null, total: { $sum: "$commissionAmountCents" } } },
      ]);
      const used = alreadyPerReferred[0]?.total || 0;
      capped = Math.min(capped, Math.max(0, maxPerReferred - used));
    }

    const maxPerSponsorMonth = snapshot?.maxCommissionPerSponsorPerMonthCents;
    if (maxPerSponsorMonth != null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const alreadyPerMonth = await ReferralCommission.aggregate([
        {
          $match: {
            sponsorUserId,
            status: { $in: ["pending", "approved", "paid"] },
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, total: { $sum: "$commissionAmountCents" } } },
      ]);
      const used = alreadyPerMonth[0]?.total || 0;
      capped = Math.min(capped, Math.max(0, maxPerSponsorMonth - used));
    }

    return Math.max(0, capped);
  }

  /**
   * Crée une commission pour un paiement encaissé (idempotent via paymentId).
   *
   * @param {Object} payment
   *  - userId: id de l'utilisateur qui a payé (le filleul potentiel)
   *  - amountHtCents: montant HT en centimes
   *  - paymentId: identifiant stable du paiement
   *  - orderId / subscriptionId / invoiceId (optionnels)
   *  - revenueType: 'particulier_service' | 'pro_service' | 'pro_subscription'
   * @returns {Object|null} la commission créée ou null
   */
  static async createCommissionForPayment(payment) {
    const { userId, amountHtCents, paymentId, orderId, subscriptionId, invoiceId, revenueType } = payment;
    if (!userId || !paymentId || !amountHtCents || !revenueType) return null;

    const referral = await Referral.findOne({ referredUserId: userId, status: "active" });
    if (!referral) return null;

    const now = new Date();
    const durationKey = REVENUE_TYPE_TO_DURATION_KEY[revenueType];
    if (!durationKey) return null;

    // Vérifie la fenêtre de rémunération du type de revenu concerné
    const rewardEndAt = referral.rewardEndsByType?.[durationKey];
    if (!rewardEndAt || now > new Date(rewardEndAt)) return null;

    const rateKey = REVENUE_TYPE_TO_RATE_KEY[revenueType];
    const commissionRate = referral.programSnapshot?.commissionRates?.[rateKey];
    if (commissionRate == null || commissionRate <= 0) return null;

    const rawCommissionCents = calculateCommissionCents(amountHtCents, commissionRate);
    const commissionAmountCents = await this.applyCommissionCaps({
      sponsorUserId: referral.sponsorUserId,
      referredUserId: referral.referredUserId,
      revenueType,
      amountCents: rawCommissionCents,
      snapshot: referral.programSnapshot,
    });
    if (commissionAmountCents <= 0) return null;

    const validationDelay = referral.programSnapshot?.validationDelayDays ?? 0;
    const eligibleAt = new Date(now.getTime() + validationDelay * 24 * 60 * 60 * 1000);

    let commission;
    try {
      commission = await ReferralCommission.create({
        referralId: referral._id,
        sponsorUserId: referral.sponsorUserId,
        referredUserId: referral.referredUserId,
        revenueType,
        source: {
          paymentId,
          orderId: orderId || null,
          subscriptionId: subscriptionId || null,
          invoiceId: invoiceId || null,
        },
        baseAmountHtCents: amountHtCents,
        commissionRate,
        commissionAmountCents,
        status: "pending",
        eligibleAt,
      });
    } catch (e) {
      // Duplicate key sur source.paymentId → déjà traitée (retry webhook)
      if (e && e.code === 11000) return null;
      throw e;
    }

    // Email au parrain : nouvelle commission
    try {
      const sponsor = await Users.findById(referral.sponsorUserId).select("email firstName lastName fullName").lean();
      if (sponsor?.email) {
        sendEmail({
          to: sponsor.email,
          templateId: constants.BREVO.REFERRAL_NEW_COMMISSION,
          params: {
            sponsorFirstName: sponsor.firstName || sponsor.fullName || "",
            commissionAmount: (commissionAmountCents / 100).toFixed(2),
          },
        }).catch((err) => console.error("[ReferralService] REFERRAL_NEW_COMMISSION error:", err));
      }
    } catch (e) {
      console.error("[ReferralService] commission email error:", e);
    }

    return commission;
  }

  /**
   * Valide les commissions éligibles (pending → approved).
   */
  static async approveEligibleCommissions() {
    const now = new Date();
    const result = await ReferralCommission.updateMany(
      { status: "pending", eligibleAt: { $lte: now } },
      { $set: { status: "approved", approvedAt: now } }
    );
    return result;
  }

  /**
   * Annule les commissions d'un paiement (remboursement / litige).
   */
  static async cancelCommissionsForPayment(paymentId, reason) {
    const updated = await ReferralCommission.updateMany(
      { "source.paymentId": paymentId, status: { $in: ["pending", "approved"] } },
      { $set: { status: "cancelled", cancellationReason: reason || "Remboursement" } }
    );
    return updated;
  }

  /**
   * Génère les payouts hebdomadaires : regroupe les commissions approved
   * non payées par parrain, si le total >= minimumPayout.
   */
  static async generatePayouts() {
    const setting = await this.getActiveProgramSetting();
    const minPayoutCents = setting?.minimumPayoutAmountCents ?? 5000; // défaut 50 €

    const now = new Date();
    const periodEnd = new Date(now);
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 7);

    const groups = await ReferralCommission.aggregate([
      {
        $match: {
          status: "approved",
          payoutId: { $exists: false },
        },
      },
      {
        $group: {
          _id: "$sponsorUserId",
          total: { $sum: "$commissionAmountCents" },
          commissionIds: { $push: "$_id" },
        },
      },
    ]);

    const payouts = [];
    for (const group of groups) {
      if (group.total < minPayoutCents) continue;

      // Vérifie que le parrain a un compte Stripe Connect actif
      const sponsor = await Users.findById(group._id).select("stripeConnectAccountId stripeConnectActive email firstName fullName").lean();
      if (!sponsor?.stripeConnectAccountId || !sponsor.stripeConnectActive) continue;

      const payout = await ReferralPayout.create({
        sponsorUserId: group._id,
        periodStart,
        periodEnd,
        totalAmountCents: group.total,
        payoutMethod: "stripe_connect",
        beneficiary: {},
        status: "pending",
        commissionIds: group.commissionIds,
      });

      // Marque les commissions comme liées au payout
      await ReferralCommission.updateMany(
        { _id: { $in: group.commissionIds } },
        { $set: { payoutId: payout._id, status: "paid", paidAt: now } }
      );

      payouts.push(payout);
    }

    return payouts;
  }

  /**
   * Déclenche le transfert Stripe pour un payout vers le compte Connect du parrain.
   */
  static async transferPayout(payoutId) {
    const payout = await ReferralPayout.findById(payoutId);
    if (!payout) throw new Error("Payout introuvable");

    const sponsor = await Users.findById(payout.sponsorUserId)
      .select("stripeConnectAccountId stripeConnectActive fullName email")
      .lean();
    if (!sponsor?.stripeConnectAccountId || !sponsor.stripeConnectActive) {
      await ReferralPayout.updateOne(
        { _id: payout._id },
        { $set: { status: "failed", "provider.failureReason": "Aucun compte Stripe Connect actif" } }
      );
      throw new Error("Compte Stripe Connect requis");
    }

    const transfer = await stripe.transfers.create({
      amount: payout.totalAmountCents,
      currency: "EUR",
      destination: sponsor.stripeConnectAccountId,
      metadata: { payoutId: String(payout._id), sponsorUserId: String(payout.sponsorUserId) },
    });

    await ReferralPayout.updateOne(
      { _id: payout._id },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
          "provider.transferId": transfer.id,
          "provider.name": "stripe",
        },
      }
    );

    // Email de versement
    try {
      if (sponsor?.email) {
        sendEmail({
          to: sponsor.email,
          templateId: constants.BREVO.REFERRAL_PAYOUT_SENT,
          params: {
            sponsorFirstName: sponsor.firstName || sponsor.fullName || "",
            payoutAmount: (payout.totalAmountCents / 100).toFixed(2),
          },
        }).catch((err) => console.error("[ReferralService] REFERRAL_PAYOUT_SENT error:", err));
      }
    } catch (e) {
      console.error("[ReferralService] payout email error:", e);
    }

    return payout;
  }
}

module.exports = ReferralService;
