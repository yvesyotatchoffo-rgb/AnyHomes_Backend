const router = require("express").Router();
const controller = require("../controllers/referralProgramAdminController");

router.get("/overview", controller.overview);
router.get("/referrals", controller.listReferrals);
router.post("/referrals/:id/block", controller.blockReferral);
router.post("/referrals/:id/unblock", controller.unblockReferral);
router.get("/commissions", controller.listCommissions);
router.post("/commissions/:id/reject", controller.rejectCommission);
router.post("/commissions/:id/approve", controller.approveCommission);
router.get("/codes", controller.listCodes);
router.post("/codes/:id/disable", controller.disableCode);
router.get("/payouts", controller.listPayouts);
router.post("/payouts/:id/retry", controller.retryPayout);
router.post("/settings", controller.createProgramSetting);
router.get("/settings", controller.listProgramSettings);

module.exports = router;
