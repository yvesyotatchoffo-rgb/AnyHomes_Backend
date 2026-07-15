#!/usr/bin/env node
/**
 * Import MoteurImmo — France entière (vente + location)
 *
 * Partitionne par département puis par tranche de prix si > 10 000 annonces,
 * pour respecter la limite de pagination de l'API.
 *
 * Usage :
 *   node scripts/moteurimmo_import_france.js --dry-run              # simule
 *   node scripts/moteurimmo_import_france.js --apply                # import réel
 *   node scripts/moteurimmo_import_france.js --apply --depts 75,59  # départements spécifiques
 *
 * Variables d'env :
 *   MOTEURIMMO_PAGE_SIZE=1000     (défaut 1000)
 *   MOTEURIMMO_PAGE_DELAY_MS=200  (défaut 200)
 */
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const moteuService = require('../app/services/moteurimmo.service');
const sync = require('../app/modules/moteurimmo/sync');

const PAGE_SIZE = Number(process.env.MOTEURIMMO_PAGE_SIZE || 1000);
const DELAY_MS = Number(process.env.MOTEURIMMO_PAGE_DELAY_MS || 500);
const API_MAX = 10000;

// ── Rate limiter : max 250 requêtes/minute (sous la limite 300) ───────────
let _lastCallTime = 0;
async function rateLimitedCall(fn) {
  const now = Date.now();
  const minGap = Math.ceil(60000 / 250);
  const wait = Math.max(0, minGap - (now - _lastCallTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallTime = Date.now();
  return fn();
}

const ALL_DEPTS = [
  { code: '01', name: 'Ain' }, { code: '02', name: 'Aisne' }, { code: '03', name: 'Allier' },
  { code: '04', name: 'Alpes-de-Haute-Provence' }, { code: '05', name: 'Hautes-Alpes' },
  { code: '06', name: 'Alpes-Maritimes' }, { code: '07', name: 'Ardèche' }, { code: '08', name: 'Ardennes' },
  { code: '09', name: 'Ariège' }, { code: '10', name: 'Aube' }, { code: '11', name: 'Aude' },
  { code: '12', name: 'Aveyron' }, { code: '13', name: 'Bouches-du-Rhône' }, { code: '14', name: 'Calvados' },
  { code: '15', name: 'Cantal' }, { code: '16', name: 'Charente' }, { code: '17', name: 'Charente-Maritime' },
  { code: '18', name: 'Cher' }, { code: '19', name: 'Corrèze' }, { code: '2A', name: 'Corse-du-Sud' },
  { code: '2B', name: 'Haute-Corse' }, { code: '21', name: "Côte-d'Or" }, { code: '22', name: "Côtes-d'Armor" },
  { code: '23', name: 'Creuse' }, { code: '24', name: 'Dordogne' }, { code: '25', name: 'Doubs' },
  { code: '26', name: 'Drôme' }, { code: '27', name: 'Eure' }, { code: '28', name: 'Eure-et-Loir' },
  { code: '29', name: 'Finistère' }, { code: '30', name: 'Gard' }, { code: '31', name: 'Haute-Garonne' },
  { code: '32', name: 'Gers' }, { code: '33', name: 'Gironde' }, { code: '34', name: 'Hérault' },
  { code: '35', name: 'Ille-et-Vilaine' }, { code: '36', name: 'Indre' }, { code: '37', name: 'Indre-et-Loire' },
  { code: '38', name: 'Isère' }, { code: '39', name: 'Jura' }, { code: '40', name: 'Landes' },
  { code: '41', name: 'Loir-et-Cher' }, { code: '42', name: 'Loire' }, { code: '43', name: 'Haute-Loire' },
  { code: '44', name: 'Loire-Atlantique' }, { code: '45', name: 'Loiret' }, { code: '46', name: 'Lot' },
  { code: '47', name: 'Lot-et-Garonne' }, { code: '48', name: 'Lozère' }, { code: '49', name: 'Maine-et-Loire' },
  { code: '50', name: 'Manche' }, { code: '51', name: 'Marne' }, { code: '52', name: 'Haute-Marne' },
  { code: '53', name: 'Mayenne' }, { code: '54', name: 'Meurthe-et-Moselle' }, { code: '55', name: 'Meuse' },
  { code: '56', name: 'Morbihan' }, { code: '57', name: 'Moselle' }, { code: '58', name: 'Nièvre' },
  { code: '59', name: 'Nord' }, { code: '60', name: 'Oise' }, { code: '61', name: 'Orne' },
  { code: '62', name: 'Pas-de-Calais' }, { code: '63', name: 'Puy-de-Dôme' }, { code: '64', name: 'Pyrénées-Atlantiques' },
  { code: '65', name: 'Hautes-Pyrénées' }, { code: '66', name: 'Pyrénées-Orientales' },
  { code: '67', name: 'Bas-Rhin' }, { code: '68', name: 'Haut-Rhin' }, { code: '69', name: 'Rhône' },
  { code: '70', name: 'Haute-Saône' }, { code: '71', name: 'Saône-et-Loire' }, { code: '72', name: 'Sarthe' },
  { code: '73', name: 'Savoie' }, { code: '74', name: 'Haute-Savoie' }, { code: '75', name: 'Paris' },
  { code: '76', name: 'Seine-Maritime' }, { code: '77', name: 'Seine-et-Marne' },
  { code: '78', name: 'Yvelines' }, { code: '79', name: 'Deux-Sèvres' }, { code: '80', name: 'Somme' },
  { code: '81', name: 'Tarn' }, { code: '82', name: 'Tarn-et-Garonne' }, { code: '83', name: 'Var' },
  { code: '84', name: 'Vaucluse' }, { code: '85', name: 'Vendée' }, { code: '86', name: 'Vienne' },
  { code: '87', name: 'Haute-Vienne' }, { code: '88', name: 'Vosges' }, { code: '89', name: 'Yonne' },
  { code: '90', name: 'Territoire de Belfort' }, { code: '91', name: 'Essonne' },
  { code: '92', name: 'Hauts-de-Seine' }, { code: '93', name: 'Seine-Saint-Denis' },
  { code: '94', name: 'Val-de-Marne' }, { code: '95', name: "Val-d'Oise" },
  { code: '971', name: 'Guadeloupe' }, { code: '972', name: 'Martinique' },
  { code: '973', name: 'Guyane' }, { code: '974', name: 'La Réunion' }, { code: '976', name: 'Mayotte' },
];

// Tranches de prix pour partitionner les départements > 10k annonces
const PRICE_BUCKETS = [
  [0, 50000], [50001, 100000], [100001, 150000], [150001, 200000],
  [200001, 250000], [250001, 300000], [300001, 400000], [400001, 500000],
  [500001, 750000], [750001, 1000000], [1000001, 2000000], [2000001, 5000000],
  [5000001, 100000000],
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function probeDept(deptCode) {
  try {
    const r = await rateLimitedCall(() => axios.post('https://moteurimmo.fr/api/ads', {
      apiKey: process.env.MOTEURIMMO_API_KEY,
      locations: [{ departmentCode: Number(deptCode) }],
      withCount: true, maxLength: 1, page: 1,
    }, { timeout: 10000 }));
    return typeof r.data.count === 'number' ? r.data.count : 0;
  } catch {
    return -1;
  }
}

async function fetchPage(deptCode, page, extra = {}) {
  const body = {
    page,
    maxLength: PAGE_SIZE,
    types: ['sale', 'rental'],
    categories: ['house', 'flat'],
    locations: [{ departmentCode: Number(deptCode) }],
    ...extra,
  };
  const data = await rateLimitedCall(() => moteuService.fetchListings(body));
  return (data && Array.isArray(data.ads)) ? data.ads : [];
}

async function buildPartitions(deptCode) {
  const count = await probeDept(deptCode);
  const partitions = [];

  if (count <= 0) return { deptCode, count: 0, partitions: [] };

  if (count <= API_MAX) {
    const pages = Math.ceil(count / PAGE_SIZE);
    for (let p = 1; p <= pages; p++) {
      partitions.push({ deptCode, page: p });
    }
  } else {
    // Partitionner par tranches de prix
    for (const [min, max] of PRICE_BUCKETS) {
      const body = {
        apiKey: process.env.MOTEURIMMO_API_KEY,
        locations: [{ departmentCode: Number(deptCode) }],
        priceMin: min, priceMax: max,
        withCount: true, maxLength: 1, page: 1,
      };
      try {
        const r = await rateLimitedCall(() => axios.post('https://moteurimmo.fr/api/ads', body, { timeout: 10000 }));
        const bucketCount = typeof r.data.count === 'number' ? r.data.count : 0;
        if (bucketCount > 0) {
          const pages = Math.ceil(Math.min(bucketCount, API_MAX) / PAGE_SIZE);
          for (let p = 1; p <= pages; p++) {
            partitions.push({ deptCode, page: p, priceMin: min, priceMax: max });
          }
        }
      } catch { /* ignore */ }
    }
  }

  return { deptCode, count, partitions };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const apply = process.argv.includes('--apply');
  const deptsArg = process.argv.find(a => a.startsWith('--depts='));
  const selectedDepts = deptsArg ? deptsArg.split('=')[1].split(',').map(d => d.trim()) : null;

  if (!apply && !dryRun) {
    console.log('Usage: node scripts/moteurimmo_import_france.js --dry-run | --apply [--depts=75,59]');
    process.exit(1);
  }

  const deptsToScan = selectedDepts
    ? ALL_DEPTS.filter(d => selectedDepts.includes(d.code))
    : ALL_DEPTS;

  console.log(`Départements à traiter : ${deptsToScan.length}\n`);

  // Phase 1 : Sonder tous les départements
  console.log('=== Phase 1 : Sondage des départements ===');
  const deptInfos = [];
  for (const dept of deptsToScan) {
    process.stdout.write(`  ${dept.code} ${dept.name}...`);
    const info = await buildPartitions(dept.code);
    deptInfos.push(info);
    process.stdout.write(` ${info.count.toLocaleString('fr-FR')} annonces, ${info.partitions.length} partition(s)\n`);
    await sleep(150);
  }

  const totalAds = deptInfos.reduce((s, i) => s + i.count, 0);
  const totalPartitions = deptInfos.reduce((s, i) => s + i.partitions.length, 0);
  console.log(`\nTotal : ${totalAds.toLocaleString('fr-FR')} annonces, ${totalPartitions} appels API\n`);

  if (dryRun) {
    console.log('Dry-run terminé. Passez --apply pour importer.');
    process.exit(0);
  }

  // Phase 2 : Importer
  console.log('=== Phase 2 : Import ===');
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connecté à MongoDB');

  const run = await sync.createRun();
  const runId = run._id;
  console.log(`Run créé : ${run.runRef}\n`);

  let imported = 0, skipped = 0, errors = 0;
  let done = 0;

  for (const info of deptInfos) {
    if (info.count <= 0) continue;

    for (const p of info.partitions) {
      done++;
      process.stdout.write(`\r[${done}/${totalPartitions}] ${info.deptCode} page ${p.page}${p.priceMin ? ` (${p.priceMin/1000}k-${p.priceMax/1000}k€)` : ''}...`);

      try {
        const ads = await fetchPage(p.deptCode, p.page, {
          priceMin: p.priceMin, priceMax: p.priceMax,
        });

        for (const ad of ads) {
          try {
            const propId = await sync.upsertListing(ad);
            if (propId) {
              imported++;
              const propType = ad.type === 'rental' ? 'rent' : 'sale';
              await sync.updateRunCounts(runId, propType);
            } else {
              skipped++;
            }
          } catch (err) {
            errors++;
            if (errors <= 5) console.error(`\n  [ERR] ${err.message}`);
          }
        }

        await sleep(DELAY_MS);
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`\n  [ERR] partition ${p.deptCode} p${p.page}: ${err.message}`);
        await sleep(2000);
      }
    }
  }

  await sync.finalizeRun(runId);

  console.log(`\n\n=== Résultat ===`);
  console.log(`Importés : ${imported}`);
  console.log(`Doublons : ${skipped}`);
  console.log(`Erreurs : ${errors}`);
  await mongoose.disconnect();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nErreur fatale:', err.message);
  process.exit(1);
});
