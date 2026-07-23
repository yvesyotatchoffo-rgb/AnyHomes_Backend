const Logger = require("../utils/coachLogger");
const { sendEmail } = require("../config/brevo.config");
const logger = new Logger("LlmErrorTracker");

const ADMIN_EMAIL = "yves@anyhomes.fr";

function generateRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LLM-ERR-${ts}${rand}`;
}

class LlmErrorTracker {
  async log({ userId, userEmail, llmProvider, interactionType, errorCode, errorLabel, errorDetail, metadata }) {
    try {
      const model = require("mongoose").model("LlmErrorLog");
      const ref = generateRef();
      const entry = new model({
        error_ref: ref,
        user_id: userId || null,
        user_email: userEmail || null,
        llm_provider: llmProvider || null,
        interaction_type: interactionType,
        error_code: errorCode,
        error_label: errorLabel,
        error_detail: errorDetail || null,
        metadata: metadata || null,
      });
      await entry.save();
      logger.info("LLM error logged", { ref, code: errorCode });

      this._sendEmailAlert({ ref, errorCode, errorLabel, errorDetail, interactionType, llmProvider });

      return entry;
    } catch (err) {
      logger.error("Failed to log LLM error", { error: err.message });
    }
  }

  async _sendEmailAlert({ ref, errorCode, errorLabel, errorDetail, interactionType, llmProvider }) {
    try {
      const subject = `[LLM Alert ${errorCode}] ${errorLabel} - ${ref}`;
      const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e5d9f2;">
    <div style="background: #976DD0; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">🔴 LLM Error Alert</h1>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Référence</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${ref}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Code erreur</td><td style="padding: 8px 0; font-weight: 600; color: #e53e3e; font-size: 14px;">${errorCode}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Libellé</td><td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${errorLabel}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Type d'interaction</td><td style="padding: 8px 0; font-size: 14px;">${interactionType || "-"}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Fournisseur LLM</td><td style="padding: 8px 0; font-size: 14px;">${llmProvider || "-"}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Détail</td><td style="padding: 8px 0; font-size: 13px; color: #666;">${errorDetail || "-"}</td></tr>
        <tr><td style="padding: 8px 0; color: #666; font-size: 13px;">Date</td><td style="padding: 8px 0; font-size: 14px;">${new Date().toLocaleString("fr-FR")}</td></tr>
      </table>
      <div style="margin-top: 20px; text-align: center;">
        <a href="http://localhost:8090/llm-monitoring" style="display: inline-block; background: #976DD0; color: white; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px;">Voir dans le monitoring</a>
      </div>
    </div>
  </div>
</body>
</html>`;

      await sendEmail({
        module: "AUTH",
        to: ADMIN_EMAIL,
        subject,
        htmlContent,
      });
      logger.info("LLM error alert email sent", { ref });
    } catch (err) {
      logger.error("Failed to send LLM error alert email", { error: err.message });
    }
  }

  async updateStatus(errorRef, newStatus) {
    try {
      const model = require("mongoose").model("LlmErrorLog");
      const valid = ["pending", "traité"];
      if (!valid.includes(newStatus)) throw new Error(`Invalid status: ${newStatus}`);
      const result = await model.findOneAndUpdate(
        { error_ref: errorRef },
        { status: newStatus },
        { new: true }
      ).lean();
      return { success: true, data: result };
    } catch (err) {
      logger.error("Failed to update LLM error status", { error: err.message });
      return { success: false, error: err.message };
    }
  }

  async getLogs({ page = 1, limit = 50, errorCode, interactionType } = {}) {
    try {
      const model = require("mongoose").model("LlmErrorLog");
      const filter = {};
      if (errorCode) filter.error_code = errorCode;
      if (interactionType) filter.interaction_type = interactionType;

      const total = await model.countDocuments(filter);
      const logs = await model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const grouped = await model.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { error_code: "$error_code", user_id: "$user_id", interaction_type: "$interaction_type" },
            count: { $sum: 1 },
            latest: { $first: "$createdAt" },
            error_label: { $first: "$error_label" },
            llm_provider: { $first: "$llm_provider" },
            user_email: { $first: "$user_email" },
            error_ref: { $first: "$error_ref" },
            status: { $first: "$status" },
          },
        },
        { $sort: { latest: -1 } },
        { $limit: 500 },
      ]);

      return {
        success: true,
        data: { logs, grouped, total, page, limit },
      };
    } catch (err) {
      logger.error("Failed to get LLM error logs", { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

module.exports = new LlmErrorTracker();
