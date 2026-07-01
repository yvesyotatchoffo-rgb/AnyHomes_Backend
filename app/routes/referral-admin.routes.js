const express = require("express");
const router = express.Router();
const ReferralAdminController = require("../controllers/ReferralAdminController");

/**
 * Routes Admin pour le programme de parrainage
 * Toutes les routes doivent être protégées par middleware d'authentification admin
 */

// Overview et statistiques globales
router.get("/overview", ReferralAdminController.getOverview);

// Analytics funnel
router.get("/analytics/funnel", ReferralAdminController.getFunnel);

// Analytics par canal
router.get("/analytics/by-channel", ReferralAdminController.getAnalyticsByChannel);

// Liste des inviters (users ayant envoyé des invitations)
router.get("/inviters", ReferralAdminController.getInviters);

// Liste des invitees (users inscrits via invitation)
router.get("/invitees", ReferralAdminController.getInvitees);

// Liste des cas suspects
router.get("/suspicious", ReferralAdminController.getSuspicious);

// Liste des invitations avec filtres
router.get("/invitations", ReferralAdminController.getInvitations);

// Détails d'une invitation
router.get("/:id", ReferralAdminController.getInvitationDetail);

// Marquer comme invalide
router.post("/:id/mark-invalid", ReferralAdminController.markInvalid);

// Marquer comme rejetée (fraude)
router.post("/:id/mark-rejected", ReferralAdminController.markRejected);

module.exports = router;
