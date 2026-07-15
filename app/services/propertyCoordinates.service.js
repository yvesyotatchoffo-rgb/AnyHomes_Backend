/**
 * propertyCoordinates.service.js
 *
 * Maintains a lightweight property_coordinates collection with only the fields
 * needed for map markers. This makes $sample queries O(1) regardless of the
 * number of properties, since each doc is tiny.
 *
 * Sync is done via insertOne/deleteOne — fire-and-forget to not block the main flow.
 */

const mongoose = require('mongoose');
const PropertyCoordinates = require('../models/propertyCoordinates.model');

/**
 * Insert or update coordinate entry for an active property.
 */
async function upsert(property) {
  try {
    const newlocation = property.newlocation;
    if (!newlocation || !Array.isArray(newlocation.coordinates) || newlocation.coordinates.length < 2) return;

    const lat = newlocation.coordinates[1];
    const lng = newlocation.coordinates[0];
    if (!lat || !lng) return;

    const image = Array.isArray(property.images) && property.images.length > 0
      ? (property.images[0].file || property.images[0].originalname || '')
      : '';

    await PropertyCoordinates.updateOne(
      { _id: property._id },
      {
        $set: {
          _id: property._id,
          location: { lat, lng },
          price: property.price,
          propertyType: property.propertyType,
          city: property.city,
          zipcode: property.zipcode,
          propertyTitle: property.propertyTitle,
          image,
        },
      },
      { upsert: true }
    );
  } catch (e) {
    console.warn('[PropertyCoordinates] upsert error:', e.message);
  }
}

/**
 * Remove coordinate entry when a property is deactivated or deleted.
 */
async function remove(propertyId) {
  try {
    await PropertyCoordinates.deleteOne({ _id: propertyId });
  } catch (e) {
    console.warn('[PropertyCoordinates] remove error:', e.message);
  }
}

/**
 * Get random map markers using $sample on the lightweight collection.
 * Returns docs with shape: { _id, location: {lat, lng}, price, ... }
 */
async function getRandomMarkers(count) {
  const docs = await PropertyCoordinates.aggregate([
    { $sample: { size: count } },
  ]);
  return docs;
}

/**
 * Full rebuild — drop and re-insert all active property coordinates.
 * Safe for production: read operations use the collection while it's being rebuilt.
 */
async function reconcileAll() {
  const conn = PropertyCoordinates.collection?.conn?.db || mongoose.connection.db;
  const col = conn.collection('property_coordinates');
  const propsCol = conn.collection('properties');

  // Delete all existing entries (atomic drop would break reads)
  const BATCH = 10000;
  let processed = 0;
  let batch = [];

  const cursor = propsCol.find(
    { isDeleted: false, status: 'active', 'newlocation.coordinates': { $exists: true } },
    { projection: { _id: 1, newlocation: 1, price: 1, propertyType: 1, city: 1, zipcode: 1, propertyTitle: 1, images: { $slice: 1 } } }
  ).batchSize(BATCH);

  // Collect coordinates and clear old entries
  await col.deleteMany({});
  console.log('[PropertyCoordinates] Cleared existing entries');

  for await (const doc of cursor) {
    const coords = doc.newlocation?.coordinates;
    if (!coords || coords.length < 2) continue;

    const lat = coords[1];
    const lng = coords[0];
    if (!lat || !lng) continue;

    const image = doc.images?.[0]?.file || doc.images?.[0]?.originalname || '';
    batch.push({
      _id: doc._id,
      location: { lat, lng },
      price: doc.price,
      propertyType: doc.propertyType,
      city: doc.city,
      zipcode: doc.zipcode,
      propertyTitle: doc.propertyTitle,
      image,
    });

    if (batch.length >= BATCH) {
      await col.insertMany(batch, { ordered: false });
      processed += batch.length;
      batch = [];
      process.stdout.write(`\r  Processed ${processed} coordinates...`);
    }
  }

  if (batch.length > 0) {
    await col.insertMany(batch, { ordered: false });
    processed += batch.length;
  }

  console.log(`\n[PropertyCoordinates] Rebuilt ${processed} entries`);
}

module.exports = { upsert, remove, getRandomMarkers, reconcileAll };
