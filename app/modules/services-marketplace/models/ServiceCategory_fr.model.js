const mongoose = require('mongoose');

const ServiceCategoryFrSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  iconUrl: { type: String },
  group: { type: String, enum: ['Transaction', 'Service'], default: 'Service' },
  parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCategory_fr' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ServiceCategory_fr', ServiceCategoryFrSchema);
