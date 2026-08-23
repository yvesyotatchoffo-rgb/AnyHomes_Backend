const db = require("../models");

module.exports = {
  /**
   * Renvoie le réglage TVA central des abonnements (public).
   */
  getSetting: async (req, res) => {
    try {
      let setting = await db.billingSetting.findOne();
      if (!setting) {
        setting = await db.billingSetting.create({ vatPercent: 20 });
      }
      return res.status(200).json({ success: true, data: setting });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
      });
    }
  },

  /**
   * Met à jour le taux de TVA appliqué aux abonnements (admin).
   */
  updateSetting: async (req, res) => {
    try {
      const vatPercent = Number(req.body.vatPercent);
      if (
        req.body.vatPercent === undefined ||
        req.body.vatPercent === "" ||
        Number.isNaN(vatPercent) ||
        vatPercent < 0 ||
        vatPercent > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Taux de TVA invalide (0 à 100).",
        });
      }
      let setting = await db.billingSetting.findOne();
      if (!setting) {
        setting = new db.billingSetting();
      }
      setting.vatPercent = vatPercent;
      setting.updatedBy = req.identity?.id;
      setting.updatedAt = new Date();
      await setting.save();
      return res.status(200).json({ success: true, data: setting });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
      });
    }
  },
};