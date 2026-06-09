const mongoose = require('mongoose');

const ProServiceFrSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  summary: { type: String },
  d1: { type: String },
  d4: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory_fr', required: true },
  pro: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  priceTTC: { type: Number, required: true },
  priceHT: { type: Number, default: null },
  quantity: { type: Number },
  quantity_label: { type: String },
  modality: { type: String },
  city: { type: String, required: true },
  radiusKm: { type: Number, required: true },
  delivery_time: { type: String },
  imageUrls: [{ type: String }],
  status: { type: String, enum: ['draft', 'pending_validation', 'active', 'inactive', 'deleted'], default: 'draft' },
  is_free: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ProService_fr', ProServiceFrSchema);
