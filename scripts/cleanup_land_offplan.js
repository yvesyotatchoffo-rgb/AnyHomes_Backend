#!/usr/bin/env node
/**
 * Cleanup script: remove MoteurImmo-imported properties that are NOT existing properties
 * (land, off-plan/VEFA, terrain constructible, etc.) from both `properties` and `externallistings`.
 *
 * Usage: node scripts/cleanup_land_offplan.js [--dry-run] [--batch-size=500]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_ARG = process.argv.find(a => a.startsWith('--batch-size='));
const BATCH_SIZE = BATCH_ARG ? parseInt(BATCH_ARG.split('=')[1], 10) : 500;

const PATTERNS = [
  // Title patterns — only unambiguous indicators of non-existing properties
  // Avoid content-based patterns to prevent false positives (e.g. houses that mention
  // "terrain constructible" as a secondary feature of an existing property).
  { field: 'propertyTitle', regex: /^terrain\b/i },
  { field: 'propertyTitle', regex: /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu|plat)\b/i },
  { field: 'propertyTitle', regex: /\bterrain\s*[+&]\s*maison\b/i },
  { field: 'propertyTitle', regex: /\b(à|a)\s*bâtir\b/i },
  { field: 'propertyTitle', regex: /\bsur\s*plan\b/i },
  { field: 'propertyTitle', regex: /\bvefa\b/i },
  { field: 'propertyTitle', regex: /\bprogramme\s+neuf\b/i },
  { field: 'propertyTitle', regex: /\brésidence\s+neuve\b/i },
  { field: 'propertyTitle', regex: /\bvente\s+en\s+l[']?état\s+futur\b/i },
  { field: 'propertyTitle', regex: /\bterrain\s+avec\s+(?:pc|permis)\b/i },
];

async function main() {
  await mongoose.connect(db.url);
  console.log(`Connected to MongoDB (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  const orConditions = PATTERNS.map(p => ({ [p.field]: p.regex }));

  // First, count total matches
  const total = await db.property.countDocuments({ importBy: 'platform', $or: orConditions });
  console.log(`Total properties matching patterns: ${total}`);
  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    // Show samples
    const samples = await db.property.find({ importBy: 'platform', $or: orConditions },
      { propertyTitle: 1, type: 1, _id: 1 }
    ).limit(30).sort({ _id: -1 }).lean();
    console.log('\nSample matches (first 30):');
    samples.forEach(p => console.log(`  ${p._id} | ${(p.propertyTitle || '').slice(0, 60)} | type: ${p.type}`));
    console.log(`\nDry run — no changes made. Run without --dry-run to execute.`);
    await mongoose.disconnect();
    return;
  }

  // Process in batches
  let processed = 0;
  let lastId = null;
  const totalBatches = Math.ceil(total / BATCH_SIZE);

  while (processed < total) {
    const batchQuery = { importBy: 'platform', $or: orConditions };
    if (lastId) batchQuery._id = { $gt: lastId };

    const props = await db.property.find(batchQuery)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .select('_id propertyTitle')
      .lean();

    if (props.length === 0) break;

    const propertyIds = props.map(p => p._id);
    lastId = props[props.length - 1]._id;

    const batchNum = Math.floor(processed / BATCH_SIZE) + 1;
    console.log(`\n[Batch ${batchNum}/${totalBatches}] Deleting ${propertyIds.length} properties...`);

    // Delete related data
    const timelines = await db.timeline.deleteMany({ propertyId: { $in: propertyIds } });
    console.log(`  timeline: ${timelines.deletedCount}`);

    const mediaJobs = await db.mediaJob.deleteMany({ propertyId: { $in: propertyIds } });
    console.log(`  mediaJobs: ${mediaJobs.deletedCount}`);

    const activityLogs = await db.propertyActivityLog.deleteMany({ propertyId: { $in: propertyIds } });
    console.log(`  propertyActivityLog: ${activityLogs.deletedCount}`);

    // Delete externallistings
    const extResult = await db.externalListing.deleteMany({ propertyId: { $in: propertyIds } });
    console.log(`  externallistings: ${extResult.deletedCount}`);

    // Delete properties
    const propResult = await db.property.deleteMany({ _id: { $in: propertyIds } });
    console.log(`  properties: ${propResult.deletedCount}`);

    processed += props.length;
  }

  console.log(`\nCleanup complete. Total deleted: ${processed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
