const llmErrorTracker = require("../services/llmErrorTracker.service");
const { LLM_ERROR_CODES } = require("../constants/llmErrorCodes");
const Logger = require("../utils/coachLogger");

const logger = new Logger("AdminLlmMonitoringController");

class AdminLlmMonitoringController {
  async getLogs(req, res) {
    try {
      const { page = 1, limit = 50, errorCode, interactionType } = req.query;
      const result = await llmErrorTracker.getLogs({ page: +page, limit: +limit, errorCode, interactionType });
      return res.json(result);
    } catch (error) {
      logger.error("getLogs failed", { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getStats(req, res) {
    try {
      const model = require("mongoose").model("LlmErrorLog");

      const totalErrors = await model.countDocuments();
      const byCode = await model.aggregate([
        { $group: { _id: "$error_code", label: { $first: "$error_label" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const byType = await model.aggregate([
        { $group: { _id: "$interaction_type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const byProvider = await model.aggregate([
        { $group: { _id: "$llm_provider", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const last24h = await model.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      return res.json({
        success: true,
        data: { totalErrors, last24h, byCode, byType, byProvider },
      });
    } catch (error) {
      logger.error("getStats failed", { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getErrorCodes(req, res) {
    return res.json({ success: true, data: LLM_ERROR_CODES });
  }

  async updateStatus(req, res) {
    try {
      const { ref } = req.params;
      const { status } = req.body;
      if (!ref || !status) {
        return res.status(400).json({ success: false, error: "Missing ref or status" });
      }
      const result = await llmErrorTracker.updateStatus(ref, status);
      return res.json(result);
    } catch (error) {
      logger.error("updateStatus failed", { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new AdminLlmMonitoringController();
