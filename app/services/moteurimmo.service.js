const axios = require('axios');
const config = require('../config/moteurimmo.config');

const client = axios.create({
  baseURL: config.baseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

function log(level, message, meta) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, message, ...meta }));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function _postWithRetry(url, body = {}, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log('debug', 'http.post.attempt', { url, attempt });
      const res = await client.post(url, { apiKey: config.apiKey, ...body });
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const msg = err.response?.data || err.message;
      log('warn', 'http.post.error', { url, attempt, status, message: msg });
      if (status === 400 || status === 401 || status === 403) break;
      if (attempt < maxAttempts) await sleep(Math.min(5000, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

async function fetchListings(params = {}) {
  const body = {
    page: params.page || 1,
    maxLength: params.pageSize || params.maxLength || config.defaultPageSize,
  };
  if (params.types) body.types = params.types;
  if (params.categories) body.categories = params.categories;
  if (params.publisherTypes) body.publisherTypes = params.publisherTypes;
  if (params.locations) body.locations = params.locations;
  if (params.radius) body.radius = params.radius;
  if (params.priceMin != null) body.priceMin = params.priceMin;
  if (params.priceMax != null) body.priceMax = params.priceMax;
  if (params.surfaceMin != null) body.surfaceMin = params.surfaceMin;
  if (params.surfaceMax != null) body.surfaceMax = params.surfaceMax;
  if (params.roomsMin != null) body.roomsMin = params.roomsMin;
  if (params.roomsMax != null) body.roomsMax = params.roomsMax;
  if (params.creationDateAfter) body.creationDateAfter = params.creationDateAfter;
  if (params.creationDateBefore) body.creationDateBefore = params.creationDateBefore;
  if (params.lastChangeDateAfter) body.lastChangeDateAfter = params.lastChangeDateAfter;
  if (params.sortBy) body.sortBy = params.sortBy;
  if (params.withCount) body.withCount = true;
  if (params.options) body.options = params.options;
  if (params.keywords) body.keywords = params.keywords;
  if (params.keywordsOperator) body.keywordsOperator = params.keywordsOperator;
  if (params.includedIds) body.includedIds = params.includedIds;

  const data = await _postWithRetry('/api/ads', body);
  return data;
}

async function fetchListingDetail(listingId) {
  const data = await _postWithRetry(`/api/ads`, {
    includedIds: [listingId],
    maxLength: 1,
  });
  return data && Array.isArray(data.ads) && data.ads.length > 0 ? data.ads[0] : null;
}

module.exports = { fetchListings, fetchListingDetail, client };
