/**
 * Migration : crée un code de parrainage (ReferralCode) pour chaque utilisateur
 * existant qui n'en a pas encore. Format : PREFIX-XXXX (ex: YVES-8F3K2).
 *
 * Usage : node scripts/migrate_referral_codes.js
 * Idempotent : les utilisateurs ayant déjà un code sont ignorés.
 */
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const db = require('../app/models');
const { generateReferralCode } = require('../app/utils/referral');

const ReferralCode = db.referralCodes;
const Users = db.users;

async function migrate() {
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connecté à MongoDB.');

  const users = await Users.find({ isDeleted: false, whiteLabelAgencyId: null })
    .select('_id firstName fullName')
    .lean();

  console.log(`${users.length} utilisateur(s) à traiter (hors marque blanche).`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const existing = await ReferralCode.findOne({ userId: user._id });
      if (existing) {
        skipped++;
        continue;
      }

      let code;
      let isUnique = false;
      while (!isUnique) {
        code = generateReferralCode(user.firstName || user.fullName || 'USER');
        const dup = await ReferralCode.findOne({ code });
        if (!dup) isUnique = true;
      }

      await ReferralCode.create({ userId: user._id, code, isActive: true });
      created++;
      if (created % 100 === 0) console.log(`  ...${created} codes créés`);
    } catch (err) {
      console.error(`Erreur user ${user._id}:`, err.message);
    }
  }

  console.log(`Terminé : ${created} code(s) créé(s), ${skipped} existant(s) ignoré(s).`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
