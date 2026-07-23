var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      error_ref: { type: String, required: true, unique: true },
      user_id: { type: Schema.Types.ObjectId, ref: "Users" },
      user_email: { type: String },
      llm_provider: { type: String, enum: ["deepseek", "nvidia", "perplexity", "openai", "ollama"] },
      interaction_type: { type: String, enum: ["Titre et description", "Coach IA"], required: true },
      error_code: { type: String, required: true },
      error_label: { type: String, required: true },
      error_detail: { type: String },
      status: { type: String, enum: ["pending", "traité"], default: "pending" },
      metadata: { type: Object },
    },
    { timestamps: true }
  );

  schema.index({ created_at: -1 });
  schema.index({ error_code: 1, created_at: -1 });
  schema.index({ user_id: 1, created_at: -1 });

  const LlmErrorLog = mongoose.model("LlmErrorLog", schema);
  return LlmErrorLog;
};
