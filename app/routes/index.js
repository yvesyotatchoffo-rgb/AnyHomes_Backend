const express = require("express");

const router = express();

router.use("/user", require("./users.routes"));
router.use("/upload", require("./upload.routes"));
router.use("/plan", require("./plans.routes"));
router.use("/category", require("./categories.routes"));
router.use("/amenity", require("./amenities.routes"));
router.use("/event", require("./event.routes"));
router.use("/feature", require("./features.routes"));
router.use("/agency", require("./agency.routes"));
router.use("/blogs", require("./blogs.routes"));
router.use("/faqs", require("./faq.routes"));
router.use("/content", require("./contentManagement.routes"));
router.use("/property", require("./property.routes"));
router.use("/property/qr-code", require("./qrCode.routes"));
router.use("/qr", require("./qr.routes"));
router.use("/favorites", require("./favorite.routes"));
router.use("/followUnfollow", require("./followUnfollow.routes"));
router.use("/notification", require("./notification.routes"));
router.use("/revenue", require("./revenue.routes"));
router.use("/folder", require("./folder.routes"));
router.use("/contactUs", require("./contactUs.routes"));
router.use("/service", require("./service.routes"));
router.use("/setting", require("./setting.routes"));
router.use("/chat", require("./chat.routes"));
router.use("/location", require("./location.routes"));
router.use("/alerts", require("./alerts.routes"));
router.use("/transaction", require("./transaction.routes"));
// router.use("/transactions", require("./pastTransactions.routes"));
router.use("/timeline", require("./timeline.routes"));
router.use("/savesearch", require("./saveSearch.routes"));
router.use("/quicksearch", require("./quickSearch.routes"));
router.use("/reports", require("./reports.routes"));
router.use("/payment", require("./payment.routes"));
router.use("/subscription", require("./subscription.routes"));
router.use("/cards", require("./cards.routes"));
router.use("/interests", require("./interests.routes"));
router.use("/onboarding", require("./onboarding.routes"));
router.use("/reviews", require("./reviews.routes"));
router.use("/buildingPermits", require("./buildingPermit.routes"))
router.use("/draft", require("./draftProperty.routes.js"))
router.use("/schools", require("./schools.routes.js"));
router.use("/school-types", require("./schoolTypes.routes.js"));
router.use("/funnelUrl", require("./funnelUrl.routes.js"));
router.use("/funnelVideoLike", require("./funnelVideoLike.routes.js"));
router.use("/tags", require("./tags.routes.js"));
router.use("/contactTeam", require("./contactTeam.routes.js"));
router.use("/peerCampaign", require("./peerCampaign.routes.js"));
router.use("/blogCategories", require("./blogCategories.routes.js"));
router.use("/form",require("./form.routes.js"));
router.use("/presetSearches",require("./presetSearches.routes.js"));
router.use("/agencyReviews",require("./agencyReviews.routes.js"));
router.use("/adminSettings",require("./adminSettings.routes.js"));
router.use("/support",require("./support.routes.js"));
router.use("/adminDashboard", require("./adminDashboard.routes.js"));
router.use("/dashboard", require("./frontendDashboard.routes.js"));
router.use("/api/dashboard", require("./frontendDashboard.routes.js"));
router.use("/score", require("./score.routes"));
router.use("/scoreParameters", require("./scoreParameters.routes"));

// ── Marketplace de services ────────────────────────────────────────────────
router.use("/marketplace", require("../modules/services-marketplace/routes/public"));
router.use("/pro/marketplace", require("../modules/services-marketplace/routes/pro"));
router.use("/admin/marketplace", require("../modules/services-marketplace/routes/admin"));

module.exports = router;
