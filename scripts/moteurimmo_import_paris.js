#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const sync = require('../app/modules/moteurimmo/sync');

async function main() {
  const apply = process.argv.includes('--apply');
  const pageSize = Number(process.env.MOTEURIMMO_PAGE_SIZE || 1000);
  const delayBetweenPages = Number(process.env.MOTEURIMMO_PAGE_DELAY_MS || 300);
  const locations = process.env.MOTEURIMMO_LOCATIONS ? JSON.parse(process.env.MOTEURIMMO_LOCATIONS) : [{ inseeCode: '75056', radius: 10 }];
  const categories = process.env.MOTEURIMMO_CATEGORIES ? JSON.parse(process.env.MOTEURIMMO_CATEGORIES) : null;
  const types = process.env.MOTEURIMMO_TYPES ? JSON.parse(process.env.MOTEURIMMO_TYPES) : null;
  const minPrice = process.env.MOTEURIMMO_MIN_PRICE ? Number(process.env.MOTEURIMMO_MIN_PRICE) : null;
  const maxPrice = process.env.MOTEURIMMO_MAX_PRICE ? Number(process.env.MOTEURIMMO_MAX_PRICE) : null;
  const radius = process.env.MOTEURIMMO_RADIUS ? Number(process.env.MOTEURIMMO_RADIUS) : 10;
  const status = process.env.MOTEURIMMO_STATUS ? JSON.parse(process.env.MOTEURIMMO_STATUS) : null;
  const dateField = process.env.MOTEURIMMO_DATE_FIELD || null; // e.g. 'publicationDate' or 'creationDate'
  const dateFrom = process.env.MOTEURIMMO_DATE_FROM || null;
  const dateTo = process.env.MOTEURIMMO_DATE_TO || null;

  function applyDateFilter(body, field, from, to) {
    if (!field) return;
    if (from) body[`${field}After`] = from;
    if (to) body[`${field}Before`] = to;
  }

  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const baseUrl = process.env.MOTEURIMMO_BASE_URL || 'https://moteurimmo.fr';
  const url = `${baseUrl.replace(/\/$/, '')}/api/ads`;

  console.log('Starting full Paris import (radius 10km). This may take time.');

  let run;
  if (apply) {
    run = await sync.createRun();
    console.log('Import run created:', run.runRef);
  }

  let page = 1;
  let totalProcessed = 0;
  while (true) {
    const body = {
      apiKey: process.env.MOTEURIMMO_API_KEY,
      types: types || ['rental', 'sale'],
      locations,
      maxLength: pageSize,
      includeHistory: true,
      withCount: true,
      page,
    };
    if (minPrice !== null) body.minPrice = minPrice;
    if (maxPrice !== null) body.maxPrice = maxPrice;
    if (radius !== null) body.radius = radius;
    if (status) body.status = status;
    if (categories) body.categories = categories;
    // date filters: use documented Before/After suffixes for the selected date field
    applyDateFilter(body, dateField, dateFrom, dateTo);
    console.log(`Fetching page ${page} (maxLength=${pageSize})`);
    let res;
    try {
      res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
    } catch (err) {
      console.error('Fetch failed on page', page, ':', err.response ? err.response.status : err.message);
      if (run) await sync.finalizeRun(run._id, err.message);
      break;
    }

    let ads = [];
    if (res && res.data) {
      if (Array.isArray(res.data)) ads = res.data;
      else if (Array.isArray(res.data.ads)) ads = res.data.ads;
      else if (Array.isArray(res.data.items)) ads = res.data.items;
      else if (typeof res.data === 'object') {
        // attempt to find array inside object
        const values = Object.values(res.data).filter(v => Array.isArray(v));
        ads = values[0] || [];
      }
    }

    if (!ads || ads.length === 0) {
      console.log('No items returned on page', page, '- import complete.');
      break;
    }

    console.log(`Page ${page} returned ${ads.length} items — processing...`);
    let processedThisPage = 0;
    for (let raw of ads) {
      try {
        if (apply) {
          const rawType = raw.transactionType || raw.listingType || raw.adType || raw.offerType || raw.propertyType || raw.type || '';
          const isRent = /rent|location|locatif|loué|bail/i.test(rawType);
          const inferred = isRent ? 'rent' : 'sale';
          await sync.upsertListing(raw);
          await sync.updateRunCounts(run._id, inferred);
        }
        processedThisPage++;
        totalProcessed++;
      } catch (err) {
        console.error('Upsert error (continuing):', err && err.message ? err.message : err);
        if (apply && run) await sync.updateRunCounts(run._id, null);
      }
    }

    console.log(`Page ${page} processed ${processedThisPage} items (total processed: ${totalProcessed})`);
    page += 1;
    await new Promise(r => setTimeout(r, delayBetweenPages));
  }

  console.log('Import finished. Total processed:', totalProcessed);
  if (run) {
    await sync.finalizeRun(run._id);
    console.log('Import run', run.runRef, 'finalized.');
  }
  await mongoose.disconnect();
}

main();
