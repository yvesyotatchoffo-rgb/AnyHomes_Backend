/**
 * Script to reconcile/create important MongoDB indexes for past transactions.
 * Usage: node scripts/reconcile_indexes.js
 */
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');

async function main() {
  console.log('Connecting to MongoDB at', dbConfig.url);
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const coll = db.collection('transactions');
  console.log('Ensuring indexes on collection transactions');

  try {
    await coll.createIndex({ year: 1 });
    console.log('Index ensured: { year: 1 }');
  } catch (e) { console.error('year index failed:', e.message); }

  try {
    await coll.createIndex({ land_value_num: 1 });
    console.log('Index ensured: { land_value_num: 1 }');
  } catch (e) { console.error('land_value_num index failed:', e.message); }

  try {
    await coll.createIndex({ lot1_surface_carrez_num: 1 });
    console.log('Index ensured: { lot1_surface_carrez_num: 1 }');
  } catch (e) { console.error('lot1_surface_carrez_num index failed:', e.message); }

  try {
    await coll.createIndex({ createdAt: -1, _id: -1 });
    console.log('Index ensured: { createdAt: -1, _id: -1 }');
  } catch (e) { console.error('createdAt index failed:', e.message); }

  try {
    await coll.createIndex({ location: '2dsphere' });
    console.log('Index ensured: { location: 2dsphere }');
  } catch (e) { console.error('location 2dsphere index failed:', e.message); }

  console.log('Index reconciliation complete. Closing connection.');
  await mongoose.disconnect();
}

main().catch(err => { console.error('Reconcile indexes failed:', err); process.exit(1); });
