const express = require("express");
const router = express.Router();
const referral = require("../controllers/ReferralController");

// Authenticated routes
router.get("/me", referral.getMe);
router.post("/track-share", referral.trackShare);
router.post("/send-email-invite", referral.sendEmailInvite);

module.exports = router;
