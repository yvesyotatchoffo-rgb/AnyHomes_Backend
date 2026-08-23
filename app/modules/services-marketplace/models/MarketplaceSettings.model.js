const mongoose = require('mongoose');

const MarketplaceSettingsSchema = new mongoose.Schema({
  commissionPercent: { type: Number, default: 25 }, // 25% HT
  whiteLabelCommissionPercent: { type: Number, default: 10 }, // 10% HT — marque blanche
  vatPercent: { type: Number, default: 20 },
  minPayoutDelayDays: { type: Number, default: 3 },
  maxServicesPerPro: { type: Number, default: 10 },
  paymentInfo: { type: String, default: "Vous payez le service \u00e0 la commande et les fonds ne seront transmis au professionnel qu'au moment o\u00f9 vous nous confirmerez que le service a bien \u00e9t\u00e9 r\u00e9alis\u00e9 par le professionnel." },
  supportedLanguages: [{ type: String, default: ['fr', 'en'] }],
  autoValidateServices: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MarketplaceSettings', MarketplaceSettingsSchema);
