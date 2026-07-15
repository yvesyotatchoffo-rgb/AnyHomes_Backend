#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

async function main() {
  await mongoose.connect(db.url);

  const cursor = db.property.find({
    importBy: 'platform',
    propertyTitle: /\bconstructible\b/i,
  }, { propertyTitle: 1, _id: 0 }).limit(50).sort({ _id: -1 }).batchSize(100);

  let count = 0;
  for await (const p of cursor) {
    count++;
    console.log(`  ${p.propertyTitle.slice(0, 80)}`);
  }
  console.log(`\nTotal sampled: ${count}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
