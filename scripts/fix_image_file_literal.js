#!/usr/bin/env node
/**
 * Fix: the previous migration stored the literal string "$$elem.originalname"
 * instead of the actual originalname value. This script reads all affected
 * properties and sets images[].file = images[].originalname using bulkWrite.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const db = require('../app/models');

async function main() {
  await mongoose.connect(db.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const cursor = db.property.find({
    'images.file': '$$elem.originalname'
  }, { _id: 1, images: 1 }).batchSize(500).lean();

  let processed = 0;
  let batch = [];

  for await (const prop of cursor) {
    const ops = [];
    for (let i = 0; i < (prop.images || []).length; i++) {
      const img = prop.images[i];
      if (img.originalname) {
        ops.push({
          updateOne: {
            filter: { _id: prop._id, 'images.originalname': img.originalname, 'images.file': '$$elem.originalname' },
            update: { $set: { 'images.$.file': img.originalname } }
          }
        });
      }
    }
    if (ops.length) batch.push(...ops);

    if (batch.length >= 500) {
      await db.property.bulkWrite(batch);
      processed += batch.length;
      batch = [];
      console.log('Processed operations:', processed);
    }
  }

  if (batch.length) {
    await db.property.bulkWrite(batch);
    processed += batch.length;
  }

  console.log('Done. Fixed ~', processed, 'operations');

  const remaining = await db.property.countDocuments({ 'images.file': '$$elem.originalname' });
  console.log('Properties still with literal $$elem:', remaining);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});