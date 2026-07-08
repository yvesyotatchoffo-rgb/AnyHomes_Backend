var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      // Identification
      trigger_ref: {
        type: String,
        required: true,
        unique: true,
        enum: [
          "OC_V01",
          "OC_V02",
          "OC_V03",
          "OC_V04",
          "OC_V07",
          "OC_V08",
          "OC_V09",
          "OC_V10",
          "OC_V12",
          "OC_V15",
          "OC_V16",
          "OC_V17",
          "OC_V29",
          "OC_V32",
          "OC_V33",
          "OC_L01",
          "OC_L03",
          "OC_L12",
          "OC_L14",
          "OC_L15",
          "OC_L23",
          "OC_L33",
        ],
      },
      transaction_type: {
        type: String,
        enum: ["VENTE", "LOCATION"],
        required: true,
      },
      funnel_status: { type: String, required: true }, // ex: "offer_received", "visit_booked"

      // Mapping vers coach intent
      coach_intent: {
        type: String,
        required: true,
        enum: [
          "welcome_first_lead_sale",
          "prepare_visit_sale",
          "post_visit_next_steps_sale",
          "analyze_visit_feedback_sale",
          "prepare_seller_file",
          "respond_to_offer_sale",
          "handle_refused_counter_offer_sale",
          "prepare_pre_contract_sale",
          "prepare_final_signing_sale",
          "celebrate_sale_closed",
          "welcome_first_lead_rental",
          "prepare_visit_rental",
          "prepare_rental_application_review",
          "analyze_rental_application",
          "prepare_lease_signing",
          "celebrate_lease_signed",
          "celebrate_rental_closed",
        ],
      },
      coach_need_family: {
        type: String,
        enum: [
          "onboarding",
          "visit_preparation",
          "post_visit",
          "offer_management",
          "rental_candidate_review",
          "transaction_signing",
          "transaction_closure",
        ],
        required: true,
      },

      // Règles de répétition
      multi_intent_allowed_in_family: { type: Boolean, default: false },
      context_transition_key: { type: String, required: true }, // ex: "offer_received_sale"

      // Activation
      message_coach_ia: { type: Boolean, default: true },
      learning_center_recommended: { type: Boolean, default: false },

      // Configuration
      dedupe_window_months: { type: Number, default: 12, min: 1 },
      active: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

  // Performance indexes
  schema.index({ trigger_ref: 1 });
  schema.index({ coach_intent: 1, active: 1 });
  schema.index({ transaction_type: 1, message_coach_ia: 1 });

  const CoachTriggerDefinition = mongoose.model(
    "CoachTriggerDefinition",
    schema
  );

  return CoachTriggerDefinition;
};
