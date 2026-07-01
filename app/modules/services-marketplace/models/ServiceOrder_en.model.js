const mongoose = require('mongoose');

const ServiceOrderEnSchema = new mongoose.Schema({
  serviceSnapshot: { type: Object, required: true }, // snapshot of the service at purchase
  proSnapshot: { type: Object, required: true }, // snapshot of the pro
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'ProService_en', required: true },
  property_id: { type: mongoose.Schema.Types.ObjectId, ref: 'properties', default: null },
  status: { type: String, enum: [
    'pending_payment', 'paid', 'payment_failed', 'accepted_by_pro', 'in_progress', 'delivered_by_pro', 'cancellation_requested', 'confirmed_by_buyer', 'litigation_opened', 'payout_released', 'cancelled', 'refunded'
  ], default: 'pending_payment' },
  payoutStatus: { type: String, enum: ['pending', 'released', 'cancelled'], default: 'pending' },
  quantity: { type: Number, required: true },
  cancellationRequest: { type: Object, default: null },
  cancellationResponse: { type: Object, default: null },
  cancellationRequestedAt: { type: Date, default: null },
  totalPriceTTC: { type: Number, required: true },
  totalPriceHT: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  commissionHT: { type: Number, default: 0 },
  platformAmount: { type: Number, default: 0 },
  proAmount: { type: Number, default: 0 },
  stripePaymentIntentId: { type: String },
  stripePayoutId: { type: String },
  paidAt: { type: Date },
  deliveredAt: { type: Date },
  deliveryMessage: { type: String, default: null },
  attachments: { type: [{ name: String, url: String, size: Number, mimeType: String }], default: [] },
  litigationDescription: { type: String, default: null },
  litigationInitiatedBy: { type: String, enum: ['buyer', 'pro'], default: null },
  preLitigationStatus: { type: String, default: null },
  confirmedAt: { type: Date },
  cancelledAt: { type: Date },
  refundedAt: { type: Date },
  litigationOpenedAt: { type: Date },
  payoutReleasedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ServiceOrderEnSchema.virtual('propertyId').get(function () {
  return this.property_id;
});
ServiceOrderEnSchema.set('toObject', { virtuals: true });
ServiceOrderEnSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ServiceOrder_en', ServiceOrderEnSchema);
