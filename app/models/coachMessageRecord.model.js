var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      // Traçabilité
      request_id: {
        type: mongoose.Types.ObjectId,
        ref: "CoachMessageRequest",
      },
      event_id: { type: String },

      // Utilisateur & contexte
      user_id: {
        type: mongoose.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      property_id: {
        type: mongoose.Types.ObjectId,
        ref: "properties",
        required: true,
      },
      transaction_id: {
        type: mongoose.Types.ObjectId,
        ref: "Transaction",
      },

      // Trigger & intent
      trigger_ref: { type: String, required: true },
      coach_intent: { type: String, required: true },
      coach_need_family: { type: String, required: true },
      context_transition_key: { type: String },

      // Question libre posée par l'utilisateur (intent user_question)
      user_question: { type: String, default: null },

      // Écran d'origine de la conversation (ex: "coach-immo" pour l'écran
      // Alfred coach immo IA, "dashboard" pour l'écran transaction-dashboard)
      source: { type: String, default: "dashboard" },

      // Versioning
      prompt_version: { type: String, default: "v1.0" },
      model_version: { type: String, default: "deepseek-v4-flash" },

      // Résultats processing
      status: {
        type: String,
        enum: ["generated", "sent", "failed", "skipped"],
        default: "generated",
      },
      dedupe_result: {
        type: String,
        enum: [
          "allowed",
          "blocked_same_intent",
          "blocked_strict_family",
          "blocked_same_family_same_context",
        ],
      },
      validation_result: {
        type: String,
        enum: [
          "valid",
          "invalid_json",
          "missing_fields",
          "too_long",
          "tone_mismatch",
          "invention_risk",
          "duplicate_risk",
        ],
      },

      // Quality flags
      quality_flags_json: {
        has_invention_risk: { type: Boolean, default: false },
        has_tone_mismatch: { type: Boolean, default: false },
        has_length_violation: { type: Boolean, default: false },
        has_prompt_injection_risk: { type: Boolean, default: false },
      },

      // Message généré (JSON)
      output_json: {
        title: String,
        intro: String,
        advice_points: [String],
        next_action: String,
        resource_cta: String,
      },

      // Envoi
      sent_at: Date,
      sent_to_channel: {
        type: String,
        enum: ["realtime", "polling"],
        default: "polling",
      },

      // LLM metrics
      llm_latency_ms: { type: Number },
      token_input: { type: Number },
      token_output: { type: Number },
      estimated_cost_usd: { type: Number },
    },
    { timestamps: true }
  );

  // Performance indexes for dedupe & monitoring
  schema.index({ user_id: 1, sent_at: -1 });
  schema.index({ user_id: 1, coach_intent: 1, sent_at: -1 });
  schema.index({ user_id: 1, coach_need_family: 1, sent_at: -1 });
  schema.index({
    user_id: 1,
    coach_need_family: 1,
    context_transition_key: 1,
    sent_at: -1,
  });
  schema.index({ property_id: 1, sent_at: -1 });
  schema.index({ status: 1, created_at: -1 });
  schema.index({ request_id: 1 });

  const CoachMessageRecord = mongoose.model("CoachMessageRecord", schema);

  return CoachMessageRecord;
};
