const mongoose = require('mongoose');

const MarketplaceSettingsSchema = new mongoose.Schema({
  commissionPercent: { type: Number, default: 25 }, // 25% HT
  vatPercent: { type: Number, default: 20 },
  minPayoutDelayDays: { type: Number, default: 3 },
  maxServicesPerPro: { type: Number, default: 10 },
  supportedLanguages: [{ type: String, default: ['fr', 'en'] }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MarketplaceSettings', MarketplaceSettingsSchema);
