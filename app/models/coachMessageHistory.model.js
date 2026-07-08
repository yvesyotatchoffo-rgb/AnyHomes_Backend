var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      // Clés de déduplication
      user_id: {
        type: mongoose.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      coach_intent: { type: String, required: true },
      coach_need_family: { type: String, required: true },
      context_transition_key: String, // peut être vide pour les familles strictes

      // Traçabilité vers source
      source_record_id: {
        type: mongoose.Types.ObjectId,
        ref: "CoachMessageRecord",
      },
      source_trigger_ref: { type: String },

      // Métadonnées
      sent_at: { type: Date, required: true },
      status: { type: String, enum: ["sent", "failed"], default: "sent" },

      // Versioning
      prompt_version: { type: String, default: "v1.0" },
      model_version: { type: String, default: "deepseek-v4-flash" },
    },
    { timestamps: true }
  );

  // TTL index: auto-delete after 12 months + 30 days buffer (13 months)
  const THIRTEEN_MONTHS_IN_SECONDS = 13 * 30 * 24 * 60 * 60; // Approximate
  schema.index({ sent_at: 1 }, { expireAfterSeconds: THIRTEEN_MONTHS_IN_SECONDS });

  // Deduplication indexes
  schema.index({ user_id: 1, coach_intent: 1, sent_at: -1 });
  schema.index({ user_id: 1, coach_need_family: 1, sent_at: -1 });
  schema.index({
    user_id: 1,
    coach_need_family: 1,
    context_transition_key: 1,
    sent_at: -1,
  });

  const CoachMessageHistory = mongoose.model("CoachMessageHistory", schema);

  return CoachMessageHistory;
};
