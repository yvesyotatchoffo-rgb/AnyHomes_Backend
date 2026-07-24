const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "properties",
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    funnelStage: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("invites", schema);
