#!/usr/bin/env node
/**
 * One-shot migration: set file = originalname on property.images that have
 * originalname (source URL) but no file field, so the frontend can display them.
 *
 * Also re-queues mediaJob documents that are stuck in 'downloading' status.
 *
 * Usage: node scripts/migrate_image_file_field.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

async function main() {
  await mongoose.connect(db.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  // 1. Fix property.images: set file = originalname where file is missing
  const result = await db.property.updateMany(
    { 'images.originalname': { $exists: true }, 'images.file': { $exists: false } },
    { $set: { 'images.$[elem].file': '$$elem.originalname' } },
    { arrayFilters: [{ 'elem.originalname': { $exists: true }, 'elem.file': { $exists: false } }] }
  );
  console.log('Properties updated (file field added to queued images):', result.nModified);

  // Fallback for MongoDB versions that don't support $set with $$elem references
  // Do a JS-based pass for any remaining unmatched images
  const propsToFix = await db.property.find({ 'images.originalname': { $exists: true }, 'images.file': { $exists: false } }).lean();
  if (propsToFix.length > 0) {
    console.log('JS fallback: fixing', propsToFix.length, 'remaining properties');
    let fixed = 0;
    for (const prop of propsToFix) {
      let needsSave = false;
      for (const img of (prop.images || [])) {
        if (img.originalname && !img.file) {
          img.file = img.originalname;
          needsSave = true;
        }
      }
      if (needsSave) {
        await db.property.updateOne({ _id: prop._id }, { $set: { images: prop.images } });
        fixed++;
      }
    }
    console.log('JS fallback: fixed', fixed, 'properties');
  }

  // 2. Re-queue mediaJobs stuck in 'downloading' status
  const requeued = await db.mediaJob.updateMany(
    { status: 'downloading' },
    { $set: { status: 'queued' } }
  );
  console.log('MediaJobs re-queued (were stuck in downloading):', requeued.nModified);

  // 3. Summary
  const queued = await db.mediaJob.countDocuments({ status: 'queued' });
  const done = await db.mediaJob.countDocuments({ status: 'done' });
  const failed = await db.mediaJob.countDocuments({ status: 'failed' });
  console.log(`\nSummary: ${queued} queued, ${done} done, ${failed} failed`);

  await mongoose.disconnect();
  console.log('Migration complete.');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});