"use strict";

const db = require("../models");
const mongoose = require("mongoose");
const ProServiceFr = require("../modules/services-marketplace/models/ProService_fr.model");
const ServiceOrderFr = require("../modules/services-marketplace/models/ServiceOrder_fr.model");
const ServiceFavorite = require("../modules/services-marketplace/models/ServiceFavorite.model");
const ServiceReviewFr = require("../modules/services-marketplace/models/ServiceReview_fr.model");

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

      return res.status(200).json({
        success: true,
        data: {
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
            agencySlug: user.agencySlug,
            agencyName: user.agencyName,
            sidebarColor: user.sidebarColor,
            buttonColor: user.buttonColor,
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
};
