/**
 * cache.service.js
 *
 * Redis-backed cache layer for expensive queries (listing page 1, counts, map markers).
 * Gracefully degrades when Redis is unavailable — all errors are swallowed.
 *
 * Key naming convention:
 *   listing:p1:{hash(query)}  → page 1 listing results (TTL 60s)
 *   count:{hash(query)}       → count results (TTL 120s)
 *   markers:{count}           → map markers (TTL 600s)
 */

const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const DEFAULT_TTL = 60; // seconds

let client = null;
let enabled = true;

function getClient() {
  if (client) return client;
  try {
    client = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[Cache] Redis unavailable after 3 retries — caching disabled');
          enabled = false;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    client.on('error', (err) => {
      if (enabled) {
        console.warn('[Cache] Redis error:', err.message);
      }
    });

    client.on('connect', () => {
      console.log('[Cache] Redis connected');
      enabled = true;
    });

    client.on('close', () => {
      enabled = false;
    });

    // Non-blocking connect
    client.connect().catch((err) => {
      console.warn('[Cache] Redis connection failed — caching disabled:', err.message);
      enabled = false;
    });
  } catch (e) {
    console.warn('[Cache] Redis init error — caching disabled:', e.message);
    enabled = false;
    client = null;
  }
  return client;
}

/**
 * Compute a deterministic cache key from the query object.
 * Sorts keys to ensure the same query always produces the same hash.
 */
function hashQuery(query) {
  const sorted = Object.keys(query || {})
    .sort()
    .reduce((acc, k) => {
      const v = query[k];
      if (v === undefined || v === null) return acc;
      acc[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return acc;
    }, {});
  const crypto = require('crypto');
  return crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
}

async function get(key) {
  if (!enabled) return null;
  try {
    const c = getClient();
    if (!c) return null;
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function set(key, value, ttl = DEFAULT_TTL) {
  if (!enabled) return;
  try {
    const c = getClient();
    if (!c) return;
    await c.setex(key, ttl, JSON.stringify(value));
  } catch (e) { /* silent */ }
}

async function del(key) {
  if (!enabled) return;
  try {
    const c = getClient();
    if (!c) return;
    await c.del(key);
  } catch (e) { /* silent */ }
}

/**
 * Invalidate all listing and count cache entries.
 * Called when a property is added/updated/deleted so stale data isn't served.
 * Uses Redis SCAN with a pattern to find matching keys.
 */
async function invalidatePattern(pattern) {
  if (!enabled) return;
  try {
    const c = getClient();
    if (!c) return;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      if (keys.length) await c.del(keys);
      cursor = nextCursor;
    } while (cursor !== '0');
  } catch (e) { /* silent */ }
}

async function invalidateAll() {
  await invalidatePattern('listing:*');
  await invalidatePattern('count:*');
  await invalidatePattern('markers:*');
  await invalidatePattern('dashboard:*');
}

module.exports = {
  get,
  set,
  del,
  invalidateAll,
  invalidatePattern,
  hashQuery,
};
