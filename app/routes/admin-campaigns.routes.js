const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/AdminCampaignController");

router.get("/estimation-stats", ctrl.estimationStats);
router.get("/stats", ctrl.stats);
router.get("/", ctrl.list);
router.get("/:id", ctrl.detail);

module.exports = router;
