module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;

  const schema = new Schema(
    {
      referralId: {
        type: Schema.Types.ObjectId,
        ref: "referrals",
        required: true,
        index: true,
      },
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
        index: true,
      },
      revenueType: {
        type: String,
        enum: ["particulier_service", "pro_service", "pro_subscription"],
        required: true,
        index: true,
      },
      source: {
        paymentId: { type: String, required: true },
        orderId: { type: Schema.Types.ObjectId, default: null },
        subscriptionId: { type: Schema.Types.ObjectId, default: null },
        invoiceId: { type: String, default: null },
      },
      baseAmountHtCents: {
        type: Number,
        required: true,
        min: 0,
      },
      commissionRate: {
        type: Number,
        required: true,
        min: 0,
        max: 1,
      },
      commissionAmountCents: {
        type: Number,
        required: true,
        min: 0,
      },
      currency: {
        type: String,
        default: "EUR",
        enum: ["EUR"],
      },
      status: {
        type: String,
        enum: ["pending", "approved", "paid", "rejected", "cancelled"],
        default: "pending",
        index: true,
      },
      eligibleAt: {
        type: Date,
        required: true,
        index: true,
      },
      approvedAt: {
        type: Date,
        default: null,
      },
      paidAt: {
        type: Date,
        default: null,
      },
      payoutId: {
        type: Schema.Types.ObjectId,
        ref: "referralPayouts",
        default: null,
        index: true,
      },
      rejectionReason: {
        type: String,
        default: null,
      },
      cancellationReason: {
        type: String,
        default: null,
      },
    },
    { timestamps: true }
  );

  // Idempotence : un même paiement ne peut générer qu'une seule commission.
  schema.index({ "source.paymentId": 1 }, { unique: true });
  schema.index({ sponsorUserId: 1, status: 1 });
  schema.index({ sponsorUserId: 1, createdAt: -1 });
  schema.index({ status: 1, eligibleAt: 1 });
  schema.index({ referredUserId: 1, revenueType: 1 });

  return mongooseInstance.model("referralCommissions", schema);
};
