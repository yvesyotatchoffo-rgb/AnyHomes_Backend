/**
 * Initialise la version 1 des paramètres du programme de parrainage.
 *
 * Paramètres V1 :
 *  - Taux : particulier services 10%, pro services 10%, pro abonnement 15%
 *  - Durées : 6 / 6 / 12 mois
 *  - Plafond par filleul : 500 €
 *  - Plafond par mois / parrain : 2000 €
 *  - Délai de validation : 14 jours
 *  - Minimum de payout : 50 €
 *
 * Usage : node scripts/init_referral_program.js [userId]
 * Idempotent : ne crée la version 1 que si aucune version active n'existe.
 */
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const db = require('../app/models');

const ReferralProgramSetting = db.referralProgramSettings;

async function init() {
  const adminUserId = process.argv[2] || null;
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });

  const existingActive = await ReferralProgramSetting.findOne({ isActive: true });
  if (existingActive) {
    console.log('Une version active existe déjà (version', existingActive.version, '). Rien à faire.');
    process.exit(0);
  }

  const last = await ReferralProgramSetting.findOne().sort({ version: -1 }).lean();
  const version = (last?.version || 0) + 1;

  const setting = await ReferralProgramSetting.create({
    version,
    isActive: true,
    effectiveFrom: new Date(),
    commissionRates: {
      particulierService: 0.10,
      proService: 0.10,
      proSubscription: 0.15,
    },
    rewardDurationsMonths: {
      particulierService: 6,
      proService: 6,
      proSubscription: 12,
    },
    validationDelayDays: 14,
    minimumPayoutAmountCents: 5000,
    maxCommissionPerReferredUserCents: 50000,
    maxCommissionPerSponsorPerMonthCents: 200000,
    createdByUserId: adminUserId || '000000000000000000000000',
    notes: 'Version 1 - lancement du programme de parrainage',
  });

  console.log('Programme de parrainage initialisé (version', version, '):', setting._id);
  process.exit(0);
}

init().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});
