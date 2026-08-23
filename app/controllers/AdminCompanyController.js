"use strict";

const db = require("../models");
const mongoose = require("mongoose");
const ProServiceFr = require("../modules/services-marketplace/models/ProService_fr.model");
const ServiceOrderFr = require("../modules/services-marketplace/models/ServiceOrder_fr.model");
const ServiceFavorite = require("../modules/services-marketplace/models/ServiceFavorite.model");
const ServiceReviewFr = require("../modules/services-marketplace/models/ServiceReview_fr.model");
const MarketplaceSettings = require("../modules/services-marketplace/models/MarketplaceSettings.model");

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch (_) {
    return null;
  }
};

module.exports = {
  /**
   * GET /user/admin/company-detail/:id
   * Retourne toutes les informations admin d'une company (eventOrganizer / pro).
   * Onglets: Général, Profil entreprise, Biens immo, Services à la carte, Transactions, Marketplace stats.
   */
  companyAdminDetail: async (req, res) => {
    try {
      const userId = req.params.id || req.query.id;
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }

      const oid = toObjectId(userId);

      // ── 1. Données de base de l'utilisateur ─────────────────────────────────
      const user = await db.users
        .findOne({ _id: oid, isDeleted: false })
        .populate("planId", "name planType offMarket numberOfProperty pricing amount duration")
        .lean();

      if (!user) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }

      // ── 2. Biens immobiliers gérés par ce pro ───────────────────────────────
      const properties = await db.property
        .find({ addedBy: oid, isDeleted: false })
        .select("propertyTitle propertyType city zipcode price status createdAt images surface")
        .lean();

      // ── 3. Services à la carte du pro ───────────────────────────────────────
      const services = await ProServiceFr.find({ pro: oid, status: { $ne: "deleted" } })
        .populate("category", "name")
        .lean();

      // ── 4. Transactions (commandes reçues par ce pro) ────────────────────────
      const orders = await ServiceOrderFr.find({ "proSnapshot.id": String(userId) })
        .populate("buyer", "firstName lastName fullName email image _id")
        .populate("service", "title priceTTC")
        .sort({ createdAt: -1 })
        .lean();

      // Calcul CA total
      const totalRevenueTTC = orders
        .filter((o) => ["paid", "accepted_by_pro", "in_progress", "delivered_by_pro", "confirmed_by_buyer", "payout_released"].includes(o.status))
        .reduce((sum, o) => sum + (o.totalPriceTTC || 0), 0);

      const totalProAmount = orders
        .filter((o) => o.status === "payout_released")
        .reduce((sum, o) => sum + (o.proAmount || 0), 0);

      // ── 5. Stats Marketplace par service ────────────────────────────────────
      const serviceIds = services.map((s) => s._id);

      const [favoritesByService, ordersByService, reviewsByService] = await Promise.all([
        // Favoris par service
        ServiceFavorite.aggregate([
          { $match: { service: { $in: serviceIds } } },
          { $group: { _id: "$service", totalFavorites: { $sum: 1 } } },
        ]),
        // Ventes par service
        ServiceOrderFr.aggregate([
          {
            $match: {
              service: { $in: serviceIds },
              status: { $in: ["paid", "accepted_by_pro", "in_progress", "delivered_by_pro", "confirmed_by_buyer", "payout_released"] },
            },
          },
          {
            $group: {
              _id: "$service",
              totalOrders: { $sum: 1 },
              totalRevenueTTC: { $sum: "$totalPriceTTC" },
            },
          },
        ]),
        // Avis par service
        ServiceReviewFr.aggregate([
          { $match: { pro: oid, status: "published" } },
          {
            $group: {
              _id: "$order",
              avgRating: { $avg: "$rating" },
              totalReviews: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Merge stats par service
      const favMap = Object.fromEntries(favoritesByService.map((f) => [String(f._id), f.totalFavorites]));
      const orderMap = Object.fromEntries(ordersByService.map((o) => [String(o._id), o]));

      const marketplaceStats = services.map((s) => {
        const sid = String(s._id);
        const orderStat = orderMap[sid] || {};
        return {
          serviceId: sid,
          title: s.title,
          status: s.status,
          priceTTC: s.priceTTC,
          category: s.category?.name || null,
          totalFavorites: favMap[sid] || 0,
          totalOrders: orderStat.totalOrders || 0,
          totalRevenueTTC: orderStat.totalRevenueTTC || 0,
        };
      });

      // Résumé global reviews
      const allReviewsForPro = await ServiceReviewFr.find({ pro: oid, status: "published" })
        .populate("buyer", "firstName lastName fullName image _id")
        .populate("order", "totalPriceTTC service")
        .sort({ createdAt: -1 })
        .lean();

      const avgRating =
        allReviewsForPro.length > 0
          ? allReviewsForPro.reduce((s, r) => s + r.rating, 0) / allReviewsForPro.length
          : null;

      // ── Taux de commission AnyHomes (global marketplace + perso user) ─────
      const marketplaceSettings = await MarketplaceSettings.findOne().lean();
      const globalCommissionPercentHT = marketplaceSettings?.commissionPercent ?? 25;
      const userCommissionPercentHT =
        user.marketplaceCommissionPercentHT != null && user.marketplaceCommissionPercentHT !== ""
          ? Number(user.marketplaceCommissionPercentHT)
          : null;
      const effectiveCommissionPercentHT =
        userCommissionPercentHT != null ? userCommissionPercentHT : globalCommissionPercentHT;

      return res.status(200).json({
        success: true,
        data: {
          // Taux de commission marketplace
          globalCommissionPercentHT,
          marketplaceCommissionPercentHT: userCommissionPercentHT,
          effectiveCommissionPercentHT,
          // Onglet 1 : Général
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.email,
            mobileNo: user.mobileNo,
            dialCode: user.dialCode,
            companyEmail: user.companyEmail,
            companyContactNumber: user.companyContactNumber,
            companyName: user.companyName,
            registrationNumber: user.registrationNumber,
            role: user.role,
            accountType: user.accountType,
            status: user.status,
            createdAt: user.createdAt,
            address: user.address,
            city: user.city,
            country: user.country,
            pinCode: user.pinCode,
            image: user.image,
            companyLogo: user.companyLogo,
            coverImage: user.coverImage,
            isVerified: user.isVerified,
            docVerified: user.docVerified,
            stripeConnectAccountId: user.stripeConnectAccountId,
            stripeConnectActive: user.stripeConnectActive,
            planId: user.planId,
            planType: user.planType,
            planDuration: user.planDuration,
            isBlocked: user.isBlocked,
            // Marque blanche
            whiteLabelActive: user.whiteLabelActive,
            whiteLabelActivatedAt: user.whiteLabelActivatedAt || null,
            agencySlug: user.agencySlug,
            agencyName: user.agencyName,
            sidebarColor: user.sidebarColor,
            buttonColor: user.buttonColor,
            // Marge AnyHomes marque blanche (HT %)
            marketplaceWhiteLabelCommissionPercentHT: user.marketplaceWhiteLabelCommissionPercentHT ?? null,
            // Learning Center
            learningCenterEnabled: user.learningCenterEnabled === true,
            // Marketplace
            marketplaceEnabled: user.marketplaceEnabled === true,
          },
          // Onglet 2 : Profil entreprise
          companyProfile: {
            tagline: user.tagline,
            about: user.about,
            website: user.website,
            servicesOffered: user.servicesOffered,
            servicesYouOffer: user.servicesYouOffer,
            openingHours: user.openingHours,
            closingHours: user.closingHours,
            amenities: user.amenities,
            location: user.location,
            images: user.images,
            team: user.team,
            isGlobalFavorite: user.isGlobalFavorite,
            isLocalFavorite: user.isLocalFavorite,
            isTopAgent: user.isTopAgent,
            featuredSubheading: user.featuredSubheading,
            featuredTitle: user.featuredTitle,
            featuredBio: user.featuredBio,
            featuredExperienceYears: user.featuredExperienceYears,
            featuredClientsAccompanied: user.featuredClientsAccompanied,
            featuredRatingNotes: user.featuredRatingNotes,
            featuredSatisfactionRate: user.featuredSatisfactionRate,
            featuredProfilePhoto: user.featuredProfilePhoto,
          },
          // Onglet 3 : Biens immobiliers
          properties: properties.map((p) => ({
            id: p._id,
            title: p.propertyTitle || "Sans titre",
            propertyType: p.propertyType,
            city: p.city,
            zipcode: p.zipcode,
            price: p.price,
            surface: p.surface,
            status: p.status,
            createdAt: p.createdAt,
            thumbnail: p.images?.[0] || null,
          })),
          propertiesCount: properties.length,
          // Onglet 4 : Services à la carte
          services,
          servicesCount: services.length,
          // Onglet 5 : Transactions
          transactions: {
            orders,
            totalOrders: orders.length,
            totalRevenueTTC,
            totalProAmount,
          },
          // Onglet 6 : Marketplace stats
          marketplaceStats,
          reviewsSummary: {
            totalReviews: allReviewsForPro.length,
            avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
            reviews: allReviewsForPro,
          },
        },
      });
    } catch (err) {
      console.error("[AdminCompanyController] companyAdminDetail error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },

  /**
   * PUT /user/admin/company-detail/:id/commission
   * Définit le taux de commission AnyHomes (HT %) spécifique à ce user pro.
   * Body: { commissionPercentHT: number | null } — null = retour au taux global.
   */
  updateUserCommission: async (req, res) => {
    try {
      const userId = req.params.id;
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }

      const raw = req.body?.commissionPercentHT;
      let value = null;
      if (raw !== null && raw !== undefined && raw !== "") {
        value = Number(raw);
        if (Number.isNaN(value) || value < 0 || value > 100) {
          return res.status(400).json({ success: false, message: "Taux de commission invalide (0-100)" });
        }
      }

      await db.users.updateOne(
        { _id: toObjectId(userId) },
        { $set: { marketplaceCommissionPercentHT: value } }
      );

      return res.json({ success: true, data: { marketplaceCommissionPercentHT: value } });
    } catch (err) {
      console.error("[AdminCompanyController] updateUserCommission error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },

  /**
   * PUT /user/admin/company-detail/:id/learning-center
   * Active/désactive l'accès Learning Center pour un user pro (surcharge manuelle).
   */
  updateUserLearningCenter: async (req, res) => {
    try {
      const userId = req.params.id;
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      const active = req.body?.active === true || req.body?.active === "true";
      await db.users.updateOne(
        { _id: toObjectId(userId) },
        { $set: { learningCenterEnabled: active } }
      );
      return res.json({ success: true, data: { learningCenterEnabled: active } });
    } catch (err) {
      console.error("[AdminCompanyController] updateUserLearningCenter error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },

  /**
   * PUT /user/admin/company-detail/:id/marketplace
   * Active/désactive l'accès Marketplace pour un user pro (surcharge manuelle).
   */
  updateUserMarketplace: async (req, res) => {
    try {
      const userId = req.params.id;
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      const active = req.body?.active === true || req.body?.active === "true";
      await db.users.updateOne(
        { _id: toObjectId(userId) },
        { $set: { marketplaceEnabled: active } }
      );
      return res.json({ success: true, data: { marketplaceEnabled: active } });
    } catch (err) {
      console.error("[AdminCompanyController] updateUserMarketplace error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },

  /**
   * GET /user/admin/company-detail/:id/white-label-overview
   * Statistiques de la marque blanche d'une agence.
   */
  whiteLabelOverview: async (req, res) => {
    try {
      const agencyId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(agencyId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      const oid = toObjectId(agencyId);

      const agency = await db.users.findOne({ _id: oid }).lean();
      if (!agency) return res.status(404).json({ success: false, message: "Company not found" });

      // Users de la marque blanche : les comptes rattachés à l'agence (whiteLabelAgencyId).
      // (Statistiques marque blanche = l'écosystème de l'agence, pas le profil pro lui-même.)
      const memberIds = await db.users
        .find({ whiteLabelAgencyId: oid, isDeleted: false, accountType: { $exists: true } })
        .distinct("_id");

      // Biens référencés par les users de la marque blanche
      const agencyPropertyIds = await db.property
        .distinct("_id", { addedBy: { $in: memberIds }, isDeleted: false });
      const propertyCount = agencyPropertyIds.length;

      // Transactions conclues (vente ou location) par les users de la marque blanche
      const CONCLUDED_STATUSES = [
        "completed",
        "confirmation by user",
        "owner accept the application",
      ];
      const transactions = memberIds.length > 0
        ? await db.interests
            .find({
              propertyId: { $in: agencyPropertyIds },
              isDeleted: false,
              $or: [
                { interestStatus: "completed" },
                { contractSigned: true },
                { funnelStatus: { $in: CONCLUDED_STATUSES } },
              ],
            })
            .countDocuments()
        : 0;

      // Services vendus sur la marketplace de la marque blanche (vendus par les users de l'agence)
      const marketplaceOrders = memberIds.length > 0
        ? await ServiceOrderFr.countDocuments({
            "proSnapshot.id": { $in: memberIds.map(String) },
            status: { $nin: ["cancelled", "refunded", "payment_failed"] },
          })
        : 0;

      const marketplaceSettings = await MarketplaceSettings.findOne().lean();

      return res.json({
        success: true,
        data: {
          agencyId,
          agencyName: agency.agencyName || agency.fullName || "Agence",
          whiteLabelActive: agency.whiteLabelActive === true,
          whiteLabelActivatedAt: agency.whiteLabelActivatedAt || null,
          agencySlug: agency.agencySlug || null,
          membersCount: memberIds.length,
          whiteLabelViews: agency.whiteLabelViews || 0,
          propertyCount,
          transactionsConcluded: transactions,
          marketplaceOrders,
          marketplaceWhiteLabelCommissionPercentHT:
            agency.marketplaceWhiteLabelCommissionPercentHT ?? null,
          defaultWhiteLabelCommissionPercentHT:
            marketplaceSettings?.whiteLabelCommissionPercent ?? 10,
        },
      });
    } catch (err) {
      console.error("[AdminCompanyController] whiteLabelOverview error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },

  /**
   * PUT /user/admin/company-detail/:id/white-label-commission
   * Force la marge AnyHomes marque blanche (HT %) pour cette agence.
   * Body: { commissionPercentHT: number | null }
   */
  updateUserWhiteLabelCommission: async (req, res) => {
    try {
      const userId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(String(userId))) {
        return res.status(400).json({ success: false, message: "Invalid userId" });
      }
      const raw = req.body?.commissionPercentHT;
      let value = null;
      if (raw !== null && raw !== undefined && raw !== "") {
        value = Number(raw);
        if (Number.isNaN(value) || value < 0 || value > 100) {
          return res.status(400).json({ success: false, message: "Taux de commission invalide (0-100)" });
        }
      }
      await db.users.updateOne(
        { _id: toObjectId(userId) },
        { $set: { marketplaceWhiteLabelCommissionPercentHT: value } }
      );
      return res.json({ success: true, data: { marketplaceWhiteLabelCommissionPercentHT: value } });
    } catch (err) {
      console.error("[AdminCompanyController] updateUserWhiteLabelCommission error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur: " + err.message });
    }
  },
};
