#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

async function main() {
  await mongoose.connect(db.url);

  const samples = await db.property.find({
    importBy: 'platform',
    propertyTitle: /\bsur\s*plan\b/i,
  }, { propertyTitle: 1, type: 1, _id: 0 }).limit(30).sort({ _id: -1 }).lean();

  console.log('=== "sur plan" in title ===');
  samples.forEach(p => console.log(`  ${(p.propertyTitle||'').slice(0,80)} (type: ${p.type})`));
  console.log(`\nTotal: ${samples.length}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
