module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;

  const programSnapshotSchema = new Schema(
    {
      programVersion: { type: Number, required: true },
      commissionRates: {
        particulierService: { type: Number, required: true, min: 0, max: 1 },
        proService: { type: Number, required: true, min: 0, max: 1 },
        proSubscription: { type: Number, required: true, min: 0, max: 1 },
      },
      rewardDurationsMonths: {
        particulierService: { type: Number, required: true, min: 1, max: 24 },
        proService: { type: Number, required: true, min: 1, max: 24 },
        proSubscription: { type: Number, required: true, min: 1, max: 24 },
      },
      validationDelayDays: { type: Number, required: true, min: 0, max: 90 },
      maxCommissionPerReferredUserCents: { type: Number, default: null, min: 0 },
      maxCommissionPerSponsorPerMonthCents: { type: Number, default: null, min: 0 },
    },
    { _id: false }
  );

  const schema = new Schema(
    {
      sponsorUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
      },
      referredUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        unique: true,
        index: true,
      },
      referralCodeId: {
        type: Schema.Types.ObjectId,
        ref: "referralCodes",
        required: true,
      },
      referralCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },
      referredUserType: {
        type: String,
        enum: ["particulier", "pro"],
        required: true,
        index: true,
      },
      attributionSource: {
        type: String,
        enum: ["url", "manual_code"],
        required: true,
      },
      attributedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
      rewardStartAt: {
        type: Date,
        required: true,
      },
      rewardEndsByType: {
        particulierService: { type: Date, default: null },
        proService: { type: Date, default: null },
        proSubscription: { type: Date, default: null },
      },
      status: {
        type: String,
        enum: ["active", "blocked", "cancelled", "expired"],
        default: "active",
        index: true,
      },
      blockedReason: {
        type: String,
        default: null,
      },
      fraud: {
        isFlagged: { type: Boolean, default: false, index: true },
        flaggedAt: { type: Date, default: null },
        flaggedByUserId: { type: Schema.Types.ObjectId, ref: "users", default: null },
        reason: { type: String, default: null },
      },
      programSnapshot: {
        type: programSnapshotSchema,
        required: true,
      },
    },
    { timestamps: true }
  );

  schema.index({ sponsorUserId: 1, status: 1 });
  schema.index({ sponsorUserId: 1, createdAt: -1 });
  schema.index({ status: 1, rewardEndsByType: 1 });

  return mongooseInstance.model("referrals", schema);
};
