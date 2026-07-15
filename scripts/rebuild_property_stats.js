/**
 * rebuild_property_stats.js
 *
 * One-time migration script — rebuilds the property_stats collection
 * from scratch by aggregating the properties collection.
 *
 * Usage:
 *   node scripts/rebuild_property_stats.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.DB || 'mongodb://localhost:27017/bookaro';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const col = mongoose.connection.db.collection('properties');
  const statsCol = mongoose.connection.db.collection('property_stats');

  // Drop existing stats
  await statsCol.drop().catch(() => {});
  console.log('Dropped existing property_stats');

  const BATCH = 10000;
  let skip = 0;
  let processed = 0;
  const counters = {}; // key → count

  console.log('Scanning active properties...');

  while (true) {
    const docs = await col
      .find({ isDeleted: false, status: 'active' })
      .project({ city: 1, zipcode: 1, propertyType: 1 })
      .skip(skip)
      .limit(BATCH)
      .toArray();

    if (docs.length === 0) break;

    for (const doc of docs) {
      // total
      counters['total'] = (counters['total'] || 0) + 1;

      // city
      const city = (doc.city || '').trim().toLowerCase();
      if (city) {
        const k = `city:${city}`;
        counters[k] = (counters[k] || 0) + 1;
      }

      // zipcode
      const zip = (doc.zipcode || '').trim();
      if (zip) {
        const k = `zip:${zip}`;
        counters[k] = (counters[k] || 0) + 1;
      }

      // propertyType
      const type = (doc.propertyType || '').trim().toLowerCase();
      if (type) {
        const k = `type:${type}`;
        counters[k] = (counters[k] || 0) + 1;
      }

      // Composite: city + type
      if (city && type) {
        const k = `city:${city}|type:${type}`;
        counters[k] = (counters[k] || 0) + 1;
      }

      // Composite: zip + type
      if (zip && type) {
        const k = `zip:${zip}|type:${type}`;
        counters[k] = (counters[k] || 0) + 1;
      }
    }

    processed += docs.length;
    skip += BATCH;
    process.stdout.write(`\r  Processed ${processed} documents...`);
  }

  console.log(`\nScanned ${processed} active properties`);
  console.log(`Building ${Object.keys(counters).length} stat entries...`);

  // Bulk insert
  const now = new Date();
  const docs = Object.entries(counters).map(([_id, count]) => ({ _id, count, updatedAt: now }));

  // Insert in batches
  const INSERT_BATCH = 1000;
  for (let i = 0; i < docs.length; i += INSERT_BATCH) {
    await statsCol.insertMany(docs.slice(i, i + INSERT_BATCH));
  }

  console.log('Done! Sample stats:');
  const sample = await statsCol.find({}).sort({ count: -1 }).limit(10).toArray();
  sample.forEach(s => console.log(`  ${s._id}: ${s.count.toLocaleString()}`));

  await mongoose.connection.close();
  console.log('\nMigration complete.');
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
