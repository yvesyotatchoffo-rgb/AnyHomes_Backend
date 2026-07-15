#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

const PATTERNS = {
  title: [
    ['title_starts_terrain', /^terrain\b/i],
    ['title_terrain_a_batir', /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu|plat)\b/i],
    ['title_terrain_plus_maison', /\bterrain\s*[+&]\s*maison\b/i],
    ['title_a_batir', /\b(à|a)\s*bâtir\b/i],
    ['title_constructible', /\bconstructible\b/i],
    ['title_sur_plan', /\bsur\s*plan\b/i],
    ['title_vefa', /\bvefa\b/i],
    ['title_programme_neuf', /\bprogramme\s+neuf\b/i],
    ['title_residence_neuve', /\brésidence\s+neuve\b/i],
    ['title_terrain_avec_pc', /\bterrain\s+avec\s+(pc|permis)\b/i],
    ['title_vente_etat_futur', /\bvente\s+en\s+l['\u2019]?état\s+futur\b/i],
  ],
  content: [
    ['content_terrain_a_batir', /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu)\b/i],
    ['content_vefa', /\bvente\s+en\s+l['\u2019]?état\s+futur\b/i],
  ],
};

async function main() {
  await mongoose.connect(db.url);
  console.log('Connected\n');

  for (const [name, regex] of PATTERNS.title) {
    const count = await db.property.countDocuments({ importBy: 'platform', propertyTitle: regex });
    console.log(`${name}: ${count}`);
  }

  console.log('');
  for (const [name, regex] of PATTERNS.content) {
    const count = await db.property.countDocuments({ importBy: 'platform', content: regex });
    console.log(`${name}: ${count}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
