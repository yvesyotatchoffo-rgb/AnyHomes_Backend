const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/AdminPropertyAttractivityController");

router.get("/activity-summary", ctrl.activitySummary);
router.get("/activity-logs", ctrl.activityLogs);
router.get("/index", ctrl.attractivityIndex);

module.exports = router;
