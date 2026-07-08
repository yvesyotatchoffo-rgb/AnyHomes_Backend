var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      // Idempotence
      event_id: {
        type: String,
        required: true,
        unique: true,
        sparse: true,
      },

      // Utilisateur & contexte métier
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

      // Trigger & routing
      trigger_ref: { type: String, required: true },
      coach_intent: { type: String },
      coach_need_family: { type: String },
      context_transition_key: { type: String },

      // Payload métier (minimal)
      payload_json: {
        source_status: String,
        offer_price: Number,
        lead_maturity_score: Number,
        lead_trust_score: Number,
        additional_context: String,
      },

      // Traitement
      status: {
        type: String,
        enum: [
          "received",
          "dedupe_blocked",
          "generation_pending",
          "generated",
          "validation_failed",
          "repair_pending",
          "sent",
          "failed",
          "skipped",
        ],
        default: "received",
      },

      // TTL pour auto-cleanup après 90 jours
      expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    },
    { timestamps: true }
  );

  // Performance indexes
  schema.index({ event_id: 1 });
  schema.index({ user_id: 1, created_at: -1 });
  schema.index({ status: 1, created_at: -1 });
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

  const CoachMessageRequest = mongoose.model(
    "CoachMessageRequest",
    schema
  );

  return CoachMessageRequest;
};
