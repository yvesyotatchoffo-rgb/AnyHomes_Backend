/**
 * Migration : génère un propertyRef unique (format AH-XXXXX)
 * pour tous les biens qui n'en ont pas encore.
 *
 * Usage : node scripts/migratePropertyRefs.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.DB_URL || 'mongodb://localhost:27017/bookaro';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCandidate() {
  return 'AH-' + Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

async function getUniqueRef(Property, existingRefs) {
  let ref;
  do {
    ref = generateCandidate();
  } while (existingRefs.has(ref));
  existingRefs.add(ref);
  return ref;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connecté à MongoDB :', MONGO_URI);

  const Property = mongoose.connection.collection('properties');

  // Charger les refs déjà attribuées pour éviter les doublons en mémoire
  const existing = await Property.distinct('propertyRef', { propertyRef: { $exists: true, $ne: null } });
  const existingRefs = new Set(existing);
  console.log(`Refs déjà existantes : ${existingRefs.size}`);

  // Trouver tous les biens sans propertyRef
  const cursor = Property.find({ $or: [{ propertyRef: { $exists: false } }, { propertyRef: null }] });

  let count = 0;
  for await (const doc of cursor) {
    const ref = await getUniqueRef(Property, existingRefs);
    await Property.updateOne({ _id: doc._id }, { $set: { propertyRef: ref } });
    count++;
    if (count % 50 === 0) console.log(`  ${count} biens traités…`);
  }

  console.log(`✓ Migration terminée : ${count} biens mis à jour.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Erreur migration :', err);
  process.exit(1);
});
