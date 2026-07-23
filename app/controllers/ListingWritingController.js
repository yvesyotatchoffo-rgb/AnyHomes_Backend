const listingWritingService = require("../services/listingWriting.service");
const Logger = require("../utils/coachLogger");

const logger = new Logger("ListingWritingController");

class ListingWritingController {
  async checkMissing(req, res) {
    try {
      const { formData } = req.body;
      if (!formData) {
        return res.status(400).json({ success: false, error: "Missing formData" });
      }
      const missing = listingWritingService.checkMissingFields(formData);
      return res.json({ success: true, data: missing });
    } catch (error) {
      logger.error("checkMissing failed", { error: error.message });
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async generate(req, res) {
    try {
      const { propertyId, formData, cible, ambition } = req.body;
      const userId = req.user?.id || req.user?._id;

      if (!formData) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: formData",
        });
      }

      const result = await listingWritingService.generate({
        propertyData: formData,
        cible,
        ambition,
        userId,
        propertyId: propertyId || formData?.id || formData?._id,
      });

      if (!result.success) {
        return res.status(500).json(result);
      }

      return res.json(result);
    } catch (error) {
      logger.error("generate failed", { error: error.message });
      return res.status(500).json({
        success: false,
        error: "Failed to generate listing writing",
        details: error.message,
      });
    }
  }

  async versions(req, res) {
    try {
      const { propertyId } = req.params;

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: "Missing required param: propertyId",
        });
      }

      const result = await listingWritingService.getVersions(propertyId);
      return res.json(result);
    } catch (error) {
      logger.error("versions failed", { error: error.message });
      return res.status(500).json({
        success: false,
        error: "Failed to get writing versions",
        details: error.message,
      });
    }
  }
}

module.exports = new ListingWritingController();
