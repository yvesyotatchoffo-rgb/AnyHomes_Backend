var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      property_id: {
        type: mongoose.Types.ObjectId,
        ref: "properties",
        required: true,
      },
      user_id: {
        type: mongoose.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      request_id: { type: String },

      title: { type: String, required: true },
      description: { type: String, required: true },

      tone: {
        type: String,
        enum: ["premium", "neutre", "commercial", "chaleureux", "discret"],
        required: true,
      },
      length: {
        type: String,
        enum: ["short", "medium", "long"],
        required: true,
      },
      source: {
        type: String,
        enum: ["llm", "manual", "hybrid"],
        default: "llm",
      },

      generation_data: {
        request_payload: Object,
        llm_response: Object,
        quality_flags: [String],
        missing_fields: [String],
        confidence: { type: Number, default: 0 },
        model_version: String,
        prompt_version: { type: String, default: "v1.0" },
        token_input: Number,
        token_output: Number,
        cost_usd: Number,
        latency_ms: Number,
      },

      status: {
        type: String,
        enum: ["draft", "applied", "discarded"],
        default: "draft",
      },
    },
    { timestamps: true }
  );

  schema.index({ property_id: 1, created_at: -1 });
  schema.index({ user_id: 1, created_at: -1 });

  const ListingWritingVersion = mongoose.model(
    "ListingWritingVersion",
    schema
  );

  return ListingWritingVersion;
};
