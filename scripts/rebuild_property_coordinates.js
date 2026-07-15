#!/usr/bin/env node
/**
 * rebuild_property_coordinates.js
 *
 * One-time migration: rebuild the property_coordinates collection from scratch.
 *
 * Usage:
 *   node scripts/rebuild_property_coordinates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');

async function run() {
  await mongoose.connect(dbConfig.url);
  console.log('Connected to MongoDB');

  const coordService = require('../app/services/propertyCoordinates.service');
  await coordService.reconcileAll();

  const count = await mongoose.connection.db.collection('property_coordinates').countDocuments();
  console.log(`\nproperty_coordinates has ${count.toLocaleString()} entries`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(e => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
