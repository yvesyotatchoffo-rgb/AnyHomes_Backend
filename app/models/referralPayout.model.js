module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;

  const schema = new Schema(
    {
      sponsorUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        index: true,
      },
      periodStart: { type: Date, required: true },
      periodEnd: { type: Date, required: true },
      totalAmountCents: {
        type: Number,
        required: true,
        min: 1,
      },
      currency: {
        type: String,
        default: "EUR",
        enum: ["EUR"],
      },
      status: {
        type: String,
        enum: ["pending", "processing", "paid", "failed", "cancelled"],
        default: "pending",
        index: true,
      },
      payoutMethod: {
        type: String,
        enum: ["stripe_connect"],
        required: true,
      },
      beneficiary: {
        ibanLast4: { type: String, default: null },
        accountHolderName: { type: String, default: null },
      },
      provider: {
        name: { type: String, default: "stripe" },
        transferId: { type: String, default: null, index: true },
        failureReason: { type: String, default: null },
      },
      paidAt: {
        type: Date,
        default: null,
      },
      commissionIds: [
        {
          type: Schema.Types.ObjectId,
          ref: "referralCommissions",
        },
      ],
    },
    { timestamps: true }
  );

  schema.index({ sponsorUserId: 1, periodStart: -1 });
  schema.index({ status: 1, createdAt: 1 });

  return mongooseInstance.model("referralPayouts", schema);
};
