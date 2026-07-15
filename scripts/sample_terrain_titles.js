#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

async function main() {
  await mongoose.connect(db.url);

  // Titles starting with "Terrain" but NOT matching other patterns
  const hasOtherPattern = /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu|plat)\b|\bterrain\s*[+&]\s*maison\b|\b(à|a)\s*bâtir\b|\bconstructible\b|\bterrain\s+avec\s+(pc|permis)\b/i;
  const cursor = db.property.find({
    importBy: 'platform',
    propertyTitle: /^terrain/i,
  }, { propertyTitle: 1, type: 1, _id: 0 }).limit(500).sort({ _id: -1 }).batchSize(100);

  let count = 0;
  let otherPatternCount = 0;
  for await (const p of cursor) {
    count++;
    if (!hasOtherPattern.test(p.propertyTitle)) {
      otherPatternCount++;
      if (otherPatternCount <= 20) {
        console.log(`  ${p.propertyTitle.slice(0, 70)} (type: ${p.type})`);
      }
    }
  }
  console.log(`\nTotal "Terrain..." titles sampled: ${count}`);
  console.log(`Without other patterns: ${otherPatternCount}`);

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
