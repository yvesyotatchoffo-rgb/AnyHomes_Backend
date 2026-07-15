/**
 * propertyStats.service.js
 *
 * Maintains pre-computed property counts using atomic $inc operations.
 * All counts reflect only { status: 'active', isDeleted: false } properties.
 *
 * Usage:
 *   await statsService.increment(property)   // after property becomes active
 *   await statsService.decrement(property)   // after property is deleted or deactivated
 *   await statsService.reconcileAll()        // periodic full rebuild (cron)
 */

const PropertyStats = require('../models/propertyStats.model');

/**
 * Build the list of stat keys for a given property.
 * Only called for active, non-deleted properties.
 * Includes composite keys for common filter combinations.
 */
function keysForProperty(property) {
  const keys = ['total'];

  const city = (property.city || '').trim().toLowerCase();
  if (city) keys.push(`city:${city}`);

  const zip = (property.zipcode || '').trim();
  if (zip) keys.push(`zip:${zip}`);

  const type = (property.propertyType || '').trim().toLowerCase();
  if (type) keys.push(`type:${type}`);

  // Composite keys for common filter combinations
  if (city && type) keys.push(`city:${city}|type:${type}`);
  if (zip && type) keys.push(`zip:${zip}|type:${type}`);

  return keys;
}

/**
 * Atomically increment counters for an active property.
 * Safe to call fire-and-forget (errors are swallowed to not block the main flow).
 */
async function increment(property) {
  try {
    const keys = keysForProperty(property);
    const now = new Date();
    const ops = keys.map((key) => ({
      updateOne: {
        filter: { _id: key },
        update: { $inc: { count: 1 }, $set: { updatedAt: now } },
        upsert: true,
      },
    }));
    await PropertyStats.bulkWrite(ops, { ordered: false });
  } catch (e) {
    // Non-blocking — stats are eventually consistent if this fails
    console.warn('[PropertyStats] increment error:', e.message);
  }
}

/**
 * Atomically decrement counters for an (formerly) active property.
 * Uses $max to never go below 0.
 */
async function decrement(property) {
  try {
    const keys = keysForProperty(property);
    const now = new Date();
    const ops = keys.map((key) => ({
      updateOne: {
        filter: { _id: key, count: { $gt: 0 } },
        update: { $inc: { count: -1 }, $set: { updatedAt: now } },
      },
    }));
    await PropertyStats.bulkWrite(ops, { ordered: false });
  } catch (e) {
    console.warn('[PropertyStats] decrement error:', e.message);
  }
}

/**
 * Get the total count of active properties.
 * Falls back to null if the stats doc doesn't exist yet.
 * The caller should fall back to countDocuments() when null is returned.
 */
async function getTotal() {
  try {
    const stat = await PropertyStats.findById('total').lean();
    return stat ? stat.count : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get count for a specific key (city, zip, type).
 * Returns null on miss so the caller can fall back.
 */
async function getCount(key) {
  try {
    const stat = await PropertyStats.findById(key).lean();
    return stat ? stat.count : null;
  } catch (e) {
    return null;
  }
}

/**
 * Sum all stats entries whose _id starts with the given prefix.
 * Used to aggregate city counts like "city:paris" + "city:paris 10e" + ...
 * Returns null if no matching entries found (caller should fall back).
 */
async function sumByPrefix(prefix) {
  try {
    const docs = await PropertyStats.find({ _id: { $regex: `^${prefix}` } }).lean();
    if (!docs.length) return null;
    return docs.reduce((sum, d) => sum + (d.count || 0), 0);
  } catch (e) {
    return null;
  }
}

/**
 * Full reconciliation — drop and rebuild property_stats from scratch.
 * Safe to call on a live system (reads are served from property_stats once rebuilt).
 * Designed to be called periodically (e.g. every 6h via cron).
 */
async function reconcileAll() {
  const col = PropertyStats.collection;
  const propsCol = col.connection.db.collection('properties');

  // Drop existing stats
  await col.drop().catch(() => {});
  console.log('[PropertyStats] Dropped existing stats');

  const BATCH = 10000;
  let skip = 0;
  let processed = 0;
  const counters = {};

  while (true) {
    const docs = await propsCol
      .find({ isDeleted: false, status: 'active' })
      .project({ city: 1, zipcode: 1, propertyType: 1 })
      .skip(skip)
      .limit(BATCH)
      .toArray();

    if (docs.length === 0) break;

    for (const doc of docs) {
      counters.total = (counters.total || 0) + 1;

      const city = (doc.city || '').trim().toLowerCase();
      if (city) {
        counters[`city:${city}`] = (counters[`city:${city}`] || 0) + 1;
      }

      const zip = (doc.zipcode || '').trim();
      if (zip) {
        counters[`zip:${zip}`] = (counters[`zip:${zip}`] || 0) + 1;
      }

      const type = (doc.propertyType || '').trim().toLowerCase();
      if (type) {
        counters[`type:${type}`] = (counters[`type:${type}`] || 0) + 1;
      }

      if (city && type) {
        counters[`city:${city}|type:${type}`] = (counters[`city:${city}|type:${type}`] || 0) + 1;
      }

      if (zip && type) {
        counters[`zip:${zip}|type:${type}`] = (counters[`zip:${zip}|type:${type}`] || 0) + 1;
      }
    }

    processed += docs.length;
    skip += BATCH;
  }

  const now = new Date();
  const entries = Object.entries(counters).map(([_id, count]) => ({ _id, count, updatedAt: now }));
  const INSERT_BATCH = 1000;
  for (let i = 0; i < entries.length; i += INSERT_BATCH) {
    await col.insertMany(entries.slice(i, i + INSERT_BATCH), { ordered: false });
  }

  console.log(`[PropertyStats] Rebuilt ${entries.length} entries from ${processed} active properties`);
}

module.exports = { increment, decrement, getTotal, getCount, sumByPrefix, keysForProperty, reconcileAll };
