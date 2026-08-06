var Mongoose = require("mongoose");
var Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  const schema = mongoose.Schema(
    {
      inviterUserId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
      shareCode: { type: String, required: true, index: true },
      channel: {
        type: String,
        enum: ["copy", "email", "whatsapp", "sms", "unknown"],
        default: "unknown",
      },
      source: {
        type: String,
        default: "unknown",
        // Accepts: sidebar, dashboard, profile, unknown, or toast-* (e.g., toast-after-signup, toast-after-property-created)
      },
      recipientHash: { type: String, default: null }, // hashed email if provided (SHA-256)
      recipientEmail: { type: String, default: null }, // plaintext recipient email (email channel only)
      personalMessage: { type: String, default: null, maxlength: 300 }, // optional message typed by inviter
      status: {
        type: String,
        enum: ["sent", "opened", "signed_up", "activated", "invalid", "rejected", "suspicious"],
        default: "sent",
        index: true,
      },
      landingUrl: { type: String, default: null },
      // Timestamps for each lifecycle step
      openedAt: { type: Date, default: null },
      signedUpAt: { type: Date, default: null },
      activatedAt: { type: Date, default: null },
      invalidatedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: null },
      // Anti-abuse metadata
      metadata: {
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
        invitedUserId: { type: Schema.Types.ObjectId, ref: "users", default: null },
        inviteToken: { type: String, default: null, index: true },
        tokenExpiresAt: { type: Date, default: null },
      },
      isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
  );

  return mongoose.model("referralInvitation", schema);
};
