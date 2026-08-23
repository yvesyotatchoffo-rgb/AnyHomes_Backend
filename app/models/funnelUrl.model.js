var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      topic: String,
      description: { type: String },
      description_fr: { type: String },
      funnelStatus: { type: String },
      youtubeUrl: { type: String, },
      duration: { type: String, },
      title: { type: String, },
      title_fr: { type: String, },
      addedBy: { type: Schema.Types.ObjectId, ref: "users", },
      image: { type: String, },
      videoOwner: { type: String, },
      tags: [{ type: Schema.Types.ObjectId, ref: "tags" }],
      type: { type: String },
      viewCount: { type: Number, },
      viewersId: [{ type: Schema.Types.ObjectId, ref: "users" }],
      shareCount: { type: Number, default: 0 },
      isProContent: { type: Boolean, default: false },
      status: { type: String, enum: ["active", "inactive", "pending", "rejected"], default: "active" },
    },
    { timestamps: true }
  );
  const funnelUrl = mongoose.model("funnelUrl", schema);

  return funnelUrl;
};