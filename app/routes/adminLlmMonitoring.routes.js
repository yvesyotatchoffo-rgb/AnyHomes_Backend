const controller = require("../controllers/AdminLlmMonitoringController");
const { adminAuth } = require("../middleware/adminAuth");
const router = require("express").Router();

router.get("/llm-monitoring/logs", adminAuth, (req, res) => {
  controller.getLogs(req, res);
});

router.get("/llm-monitoring/stats", adminAuth, (req, res) => {
  controller.getStats(req, res);
});

router.get("/llm-monitoring/error-codes", adminAuth, (req, res) => {
  controller.getErrorCodes(req, res);
});

router.put("/llm-monitoring/logs/:ref/status", adminAuth, (req, res) => {
  controller.updateStatus(req, res);
});

module.exports = router;
