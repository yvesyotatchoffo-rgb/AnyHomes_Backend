/**
 * Script pour ajouter des icônes SVG cohérentes à toutes les amenités
 * Lance depuis la racine du backend : node scripts/seed-amenity-icons.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const FRONTEND_PUBLIC = path.resolve(
  __dirname,
  '../../../bookaro_frontend-6_Jan/public'
);
const ICONS_DIR = path.join(FRONTEND_PUBLIC, 'assets', 'icons', 'amenities');

// ─── SVG helpers ────────────────────────────────────────────────────────────
const color = '#7C3AED';

function svg(paths) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function svgFill(paths) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}">${paths}</svg>`;
}

// ─── Icon definitions ────────────────────────────────────────────────────────
const icons = {
  // ── Heating type (Mode de consommation) ──────────────────────────────────
  'individuel': svg(
    `<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
     <path d="M9 21V12h6v9"/>`
  ),
  'collectif': svg(
    `<rect x="2" y="3" width="20" height="18" rx="1"/>
     <line x1="2" y1="9" x2="22" y2="9"/>
     <line x1="2" y1="15" x2="22" y2="15"/>
     <line x1="8" y1="9" x2="8" y2="21"/>
     <line x1="16" y1="9" x2="16" y2="21"/>`
  ),

  // ── Consumption mode (Type de chauffage) ─────────────────────────────────
  'gaz': svgFill(
    `<path d="M12 2C9 5.5 7 8.5 7 11a5 5 0 0 0 10 0c0-2.5-2-5.5-5-9zm1.5 13.5a2.5 2.5 0 0 1-3.46-2.28c.4.8 1.16 1.28 2.21 1.28.6 0 1.13-.2 1.55-.55A2.5 2.5 0 0 1 13.5 15.5z" fill="${color}"/>`
  ),
  'électricité': svgFill(
    `<path d="M13 2L4 13h7l-1 9 9-12h-7l1-8z"/>`
  ),
  'fioul': svg(
    `<path d="M12 2l3 6H9l3-6z"/>
     <path d="M7 8h10l1 3H6l1-3z"/>
     <rect x="8" y="11" width="8" height="10" rx="1"/>
     <line x1="10" y1="14" x2="10" y2="18"/>
     <line x1="14" y1="14" x2="14" y2="18"/>`
  ),
  'pompe à chaleur': svg(
    `<circle cx="12" cy="12" r="3"/>
     <path d="M12 5v2M12 17v2M5 12H3M21 12h-2"/>
     <path d="M7.05 7.05l1.42 1.42M15.54 15.54l1.42 1.42M7.05 16.95l1.42-1.42M15.54 8.46l1.42-1.42"/>
     <path d="M16 9a6 6 0 0 1-8 8" stroke-dasharray="2 2"/>`
  ),
  'bois / pellets': svg(
    `<path d="M5 21l3-9 4 4-7 5z"/>
     <path d="M19 3c-2 1-4 3-4 6 0 2 1 4 2 5"/>
     <path d="M12 14c1-2 3-4 5-4"/>
     <circle cx="17" cy="8" r="1" fill="${color}"/>`
  ),
  'solaire': svg(
    `<circle cx="12" cy="12" r="4"/>
     <line x1="12" y1="2" x2="12" y2="5"/>
     <line x1="12" y1="19" x2="12" y2="22"/>
     <line x1="2" y1="12" x2="5" y2="12"/>
     <line x1="19" y1="12" x2="22" y2="12"/>
     <line x1="4.93" y1="4.93" x2="7.05" y2="7.05"/>
     <line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/>
     <line x1="4.93" y1="19.07" x2="7.05" y2="16.95"/>
     <line x1="16.95" y1="7.05" x2="19.07" y2="4.93"/>`
  ),

  // ── Cooking ──────────────────────────────────────────────────────────────
  'cuisine américaine': svg(
    `<rect x="2" y="6" width="20" height="12" rx="1"/>
     <line x1="2" y1="11" x2="22" y2="11"/>
     <line x1="8" y1="11" x2="8" y2="18"/>
     <circle cx="5" cy="8.5" r="0.8" fill="${color}"/>
     <circle cx="10" cy="8.5" r="0.8" fill="${color}"/>`
  ),
  'cuisine équipée': svg(
    `<rect x="4" y="4" width="16" height="6" rx="1"/>
     <rect x="4" y="12" width="16" height="8" rx="1"/>
     <circle cx="8" cy="7" r="1.5"/>
     <circle cx="12" cy="7" r="1.5"/>
     <circle cx="16" cy="7" r="1.5"/>
     <line x1="4" y1="16" x2="20" y2="16"/>
     <line x1="12" y1="12" x2="12" y2="20"/>`
  ),
  'cuisine semi-équipée': svg(
    `<path d="M6 4a2 2 0 0 0-2 2v1h16V6a2 2 0 0 0-2-2H6z"/>
     <path d="M4 7v9a2 2 0 0 0 2 2h1l1 2h8l1-2h1a2 2 0 0 0 2-2V7H4z"/>
     <path d="M10 11c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z" fill="${color}" stroke="none"/>`
  ),
  'coin cuisine': svg(
    `<path d="M9 2v6M15 2v2"/>
     <path d="M9 8a3 3 0 0 0 0 6v8M15 4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2v8"/>`
  ),

  // ── Equipment ────────────────────────────────────────────────────────────
  'ascenseur': svg(
    `<rect x="5" y="2" width="14" height="20" rx="2"/>
     <line x1="12" y1="6" x2="12" y2="18"/>
     <polyline points="9 9 12 6 15 9"/>
     <polyline points="9 15 12 18 15 15"/>`
  ),
  'digicode / interphone': svg(
    `<rect x="6" y="2" width="12" height="20" rx="2"/>
     <circle cx="9" cy="7" r="1" fill="${color}"/>
     <circle cx="12" cy="7" r="1" fill="${color}"/>
     <circle cx="15" cy="7" r="1" fill="${color}"/>
     <circle cx="9" cy="11" r="1" fill="${color}"/>
     <circle cx="12" cy="11" r="1" fill="${color}"/>
     <circle cx="15" cy="11" r="1" fill="${color}"/>
     <circle cx="9" cy="15" r="1" fill="${color}"/>
     <circle cx="12" cy="15" r="1" fill="${color}"/>
     <circle cx="15" cy="15" r="1" fill="${color}"/>
     <rect x="9" y="18" width="6" height="2" rx="1" fill="${color}" stroke="none"/>`
  ),
  'gardien': svg(
    `<path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
     <path d="M9 12l2 2 4-4"/>`
  ),
  'parking': svg(
    `<rect x="3" y="3" width="18" height="18" rx="2"/>
     <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
     <line x1="9" y1="13" x2="13" y2="13"/>`
  ),
  'cave': svg(
    `<path d="M3 21h18M5 21V9l7-6 7 6v12"/>
     <path d="M10 17v4h4v-4a2 2 0 0 0-4 0z"/>
     <line x1="12" y1="13" x2="12" y2="15"/>
     <path d="M9 13h6" stroke-dasharray="2 2"/>`
  ),
  'piscine': svg(
    `<path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
     <path d="M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
     <circle cx="12" cy="5" r="2"/>
     <path d="M12 7v4M9 10h6"/>`
  ),
  'salle de sport': svg(
    `<circle cx="6.5" cy="12" r="1.5"/>
     <circle cx="17.5" cy="12" r="1.5"/>
     <path d="M5 12h14"/>
     <path d="M3 10v4M21 10v4"/>
     <circle cx="3" cy="12" r="0.8" fill="${color}"/>
     <circle cx="21" cy="12" r="0.8" fill="${color}"/>`
  ),
  'sauna': svg(
    `<rect x="3" y="8" width="18" height="13" rx="1"/>
     <path d="M7 8V5M12 8V5M17 8V5"/>
     <path d="M7 13h10M7 17h6"/>
     <path d="M6 2c0 2 2 2 2 4M10 2c0 2 2 2 2 4M14 2c0 2 2 2 2 4"/>`
  ),

  // ── Outside ───────────────────────────────────────────────────────────────
  'balcon': svg(
    `<rect x="4" y="4" width="16" height="8" rx="1"/>
     <line x1="4" y1="12" x2="4" y2="20"/>
     <line x1="20" y1="12" x2="20" y2="20"/>
     <line x1="4" y1="20" x2="20" y2="20"/>
     <line x1="8" y1="12" x2="8" y2="20"/>
     <line x1="12" y1="12" x2="12" y2="20"/>
     <line x1="16" y1="12" x2="16" y2="20"/>`
  ),
  'terrasse': svg(
    `<rect x="2" y="14" width="20" height="6" rx="1"/>
     <line x1="6" y1="14" x2="6" y2="20"/>
     <line x1="12" y1="14" x2="12" y2="20"/>
     <line x1="18" y1="14" x2="18" y2="20"/>
     <path d="M6 14l6-8 6 8"/>
     <path d="M4 8h16"/>`
  ),
  'jardin': svg(
    `<circle cx="12" cy="8" r="4"/>
     <path d="M12 12v10"/>
     <path d="M9 15c-2-1-4-3-4-5"/>
     <path d="M15 15c2-1 4-3 4-5"/>
     <path d="M8 20c0-2 2-3 4-3s4 1 4 3"/>`
  ),
  'loggia': svg(
    `<rect x="4" y="3" width="16" height="14" rx="1"/>
     <line x1="4" y1="9" x2="20" y2="9"/>
     <line x1="9" y1="9" x2="9" y2="17"/>
     <line x1="15" y1="9" x2="15" y2="17"/>
     <rect x="2" y="17" width="20" height="4" rx="1"/>`
  ),
  'véranda': svg(
    `<path d="M2 20h20"/>
     <path d="M12 4L2 14h20L12 4z"/>
     <line x1="12" y1="4" x2="12" y2="20"/>
     <line x1="7" y1="14" x2="7" y2="20"/>
     <line x1="17" y1="14" x2="17" y2="20"/>
     <rect x="7" y="14" width="10" height="6"/>`
  ),

  // ── Services and accessibility ────────────────────────────────────────────
  'accès handicapé': svg(
    `<circle cx="12" cy="4" r="2"/>
     <path d="M9 10h6l1 6H8l1-6z"/>
     <path d="M8 16l-2 5M16 16l2 5"/>
     <circle cx="8" cy="21" r="0.5" fill="${color}"/>
     <circle cx="16" cy="21" r="0.5" fill="${color}"/>`
  ),
  'fibre optique': svg(
    `<path d="M5 13a7 7 0 0 1 14 0"/>
     <path d="M2 16a11 11 0 0 1 20 0"/>
     <line x1="12" y1="19" x2="12" y2="22"/>
     <circle cx="12" cy="20" r="1.5" fill="${color}" stroke="none"/>`
  ),
  'interphone': svg(
    `<path d="M5 4h4l2 5-2.5 1.5A11 11 0 0 0 12 14l1.5-2.5L19 14v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>`
  ),
  'vidéophone': svg(
    `<rect x="2" y="7" width="13" height="10" rx="2"/>
     <path d="M22 8l-6 4 6 4V8z"/>`
  ),
  'gardiennage': svg(
    `<path d="M12 2L4 5v6c0 5 4 9 8 11 4-2 8-6 8-11V5l-8-3z"/>
     <circle cx="12" cy="10" r="2"/>
     <path d="M8 18c0-2 2-3 4-3s4 1 4 3"/>`
  ),

  // ── Ancilliary areas ──────────────────────────────────────────────────────
  'box': svg(
    `<path d="M1 3h22v4H1zM3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/>
     <path d="M8 7v6h8V7"/>
     <line x1="12" y1="7" x2="12" y2="13"/>`
  ),
  'local à vélos': svg(
    `<circle cx="6" cy="16" r="4"/>
     <circle cx="18" cy="16" r="4"/>
     <path d="M6 16l3-7h3l3 7"/>
     <path d="M9 9h6"/>
     <path d="M14 9l2 7"/>
     <circle cx="15" cy="7" r="1" fill="${color}"/>`
  ),
  'buanderie': svg(
    `<rect x="4" y="2" width="16" height="20" rx="2"/>
     <circle cx="12" cy="13" r="5"/>
     <circle cx="12" cy="13" r="2.5"/>
     <path d="M7 7h3"/>
     <circle cx="14" cy="7" r="0.8" fill="${color}"/>`
  ),

  // ── Environment ───────────────────────────────────────────────────────────
  'vue mer': svg(
    `<path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>
     <path d="M12 5l2 3-4 2 4 2-2 3"/>
     <circle cx="12" cy="4" r="1" fill="${color}"/>`
  ),
  'vue montagne': svg(
    `<path d="M3 20l7-12 4 6 3-4 7 10H3z"/>
     <circle cx="18" cy="8" r="2"/>`
  ),
  'vue dégagée': svg(
    `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
     <circle cx="12" cy="12" r="3"/>`
  ),
  'quartier calme': svg(
    `<path d="M17 6c0 4-5 7-5 7s-5-3-5-7a5 5 0 0 1 10 0z"/>
     <circle cx="12" cy="6" r="1.5" fill="${color}" stroke="none"/>
     <path d="M9 16c1 1 3 1.5 3 1.5s2-.5 3-1.5"/>
     <path d="M6 20h12"/>`
  ),
  'proche forêt': svg(
    `<path d="M12 2l4 8h-2l3 6H7l3-6H8l4-8z"/>
     <line x1="12" y1="16" x2="12" y2="22"/>
     <line x1="9" y1="22" x2="15" y2="22"/>`
  ),
  'proche lac': svg(
    `<path d="M12 2a8 8 0 0 0-8 8c0 4 8 12 8 12s8-8 8-12a8 8 0 0 0-8-8z"/>
     <path d="M9 16c1-1 3-1.5 3-1.5s2 .5 3 1.5" stroke-dasharray="2 2"/>
     <circle cx="12" cy="10" r="3"/>`
  ),

  // ── Leisure ───────────────────────────────────────────────────────────────
  'jacuzzi': svg(
    `<rect x="3" y="10" width="18" height="11" rx="2"/>
     <path d="M6 6c0 2 2 2 2 4M10 6c0 2 2 2 2 4M14 6c0 2 2 2 2 4"/>
     <line x1="7" y1="14" x2="17" y2="14"/>`
  ),
  'salle de jeux': svg(
    `<rect x="2" y="6" width="20" height="12" rx="4"/>
     <circle cx="8" cy="12" r="1.5" fill="${color}" stroke="none"/>
     <line x1="14" y1="10" x2="14" y2="14"/>
     <line x1="12" y1="12" x2="16" y2="12"/>`
  ),
  'cinéma privé': svg(
    `<rect x="2" y="4" width="20" height="16" rx="2"/>
     <polygon points="10 9 16 12 10 15 10 9" fill="${color}" stroke="none"/>
     <line x1="6" y1="2" x2="4" y2="4"/>
     <line x1="18" y1="2" x2="20" y2="4"/>
     <line x1="10" y1="2" x2="10" y2="4"/>
     <line x1="14" y1="2" x2="14" y2="4"/>`
  ),
  'court de tennis': svg(
    `<circle cx="18" cy="6" r="3"/>
     <path d="M15.5 8.5L5 19"/>
     <rect x="2" y="11" width="12" height="10" rx="1"/>
     <line x1="2" y1="16" x2="14" y2="16"/>
     <line x1="8" y1="11" x2="8" y2="21"/>`
  ),

  // ── Investment ───────────────────────────────────────────────────────────
  'meublé': svg(
    `<rect x="3" y="14" width="18" height="4" rx="1"/>
     <rect x="6" y="10" width="12" height="4" rx="1"/>
     <line x1="5" y1="18" x2="5" y2="21"/>
     <line x1="19" y1="18" x2="19" y2="21"/>
     <path d="M4 10c0-2 2-4 4-4h8c2 0 4 2 4 4"/>`
  ),
  'non meublé': svg(
    `<rect x="3" y="3" width="18" height="18" rx="2"/>
     <line x1="9" y1="9" x2="15" y2="15"/>
     <line x1="15" y1="9" x2="9" y2="15"/>`
  ),
  'location saisonnière': svg(
    `<rect x="3" y="4" width="18" height="18" rx="2"/>
     <line x1="16" y1="2" x2="16" y2="6"/>
     <line x1="8" y1="2" x2="8" y2="6"/>
     <line x1="3" y1="10" x2="21" y2="10"/>
     <circle cx="8" cy="16" r="1.5" fill="${color}" stroke="none"/>
     <circle cx="12" cy="16" r="1.5" fill="${color}" stroke="none"/>
     <circle cx="16" cy="16" r="1.5" fill="${color}" stroke="none"/>`
  ),
  'colocation': svg(
    `<circle cx="9" cy="7" r="3"/>
     <circle cx="15" cy="7" r="3"/>
     <path d="M3 20c0-3 3-5 6-5h6c3 0 6 2 6 5"/>
     <path d="M6 13c-2 1-3 2-3 4"/>`
  ),
  'résidence services': svg(
    `<rect x="3" y="6" width="18" height="15" rx="1"/>
     <path d="M3 10h18M9 6V3h6v3"/>
     <path d="M12 2l.5 1.5H14l-1.3.9.5 1.6L12 5l-1.2 1 .5-1.6L10 3.5h1.5L12 2z" fill="${color}" stroke="none" transform="translate(0, 9)"/>`
  ),
};

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Create output directory
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    console.log('Created directory:', ICONS_DIR);
  }

  // 2. Write SVG files
  const fileMap = {}; // title → web path
  for (const [name, svgContent] of Object.entries(icons)) {
    const filename = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '.svg';
    const filePath = path.join(ICONS_DIR, filename);
    fs.writeFileSync(filePath, svgContent, 'utf8');
    fileMap[name] = `/assets/icons/amenities/${filename}`;
    console.log(`  ✓ ${filename}`);
  }

  // 3. Connect to DB and update amenities
  await mongoose.connect(process.env.DB_URL || 'mongodb://localhost:27017/bookaro');
  console.log('\nConnected to MongoDB — updating image fields...');

  let updated = 0;
  let notFound = [];

  for (const [name, webPath] of Object.entries(fileMap)) {
    // Match by case-insensitive title
    const result = await mongoose.connection
      .collection('amenities')
      .updateOne(
        { title: { $regex: `^${name}$`, $options: 'i' }, isDeleted: false },
        { $set: { image: webPath } }
      );
    if (result.matchedCount === 0) {
      notFound.push(name);
    } else {
      updated++;
    }
  }

  await mongoose.disconnect();

  console.log(`\n✅ Updated: ${updated}/${Object.keys(icons).length} amenities`);
  if (notFound.length) {
    console.log('⚠️  Not found in DB:', notFound.join(', '));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
