/**
 * propertyStats.service.js
 *
 * Maintains pre-computed property counts using atomic $inc operations.
 * All counts reflect only { status: 'active', isDeleted: false } properties.
 *
 * Usage:
 *   await statsService.increment(property)   // after property becomes active
 *   await statsService.decrement(property)   // after property is deleted or deactivated
 */

const PropertyStats = require('../models/propertyStats.model');

/**
 * Build the list of stat keys for a given property.
 * Only called for active, non-deleted properties.
 */
function keysForProperty(property) {
  const keys = ['total'];

  const city = (property.city || '').trim().toLowerCase();
  if (city) keys.push(`city:${city}`);

  const zip = (property.zipcode || '').trim();
  if (zip) keys.push(`zip:${zip}`);

  const type = (property.propertyType || '').trim().toLowerCase();
  if (type) keys.push(`type:${type}`);

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

module.exports = { increment, decrement, getTotal, getCount, keysForProperty };
