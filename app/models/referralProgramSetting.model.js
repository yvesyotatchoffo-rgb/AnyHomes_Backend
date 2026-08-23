module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;

  const schema = new Schema(
    {
      version: {
        type: Number,
        required: true,
        unique: true,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
      effectiveFrom: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },
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
      validationDelayDays: {
        type: Number,
        required: true,
        min: 0,
        max: 90,
      },
      minimumPayoutAmountCents: {
        type: Number,
        required: true,
        min: 0,
      },
      maxCommissionPerReferredUserCents: {
        type: Number,
        default: null,
        min: 0,
      },
      maxCommissionPerSponsorPerMonthCents: {
        type: Number,
        default: null,
        min: 0,
      },
      createdByUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
      },
      notes: {
        type: String,
        trim: true,
        default: null,
      },
    },
    { timestamps: true }
  );

  schema.index({ isActive: 1, effectiveFrom: -1 });

  return mongooseInstance.model("referralProgramSettings", schema);
};
