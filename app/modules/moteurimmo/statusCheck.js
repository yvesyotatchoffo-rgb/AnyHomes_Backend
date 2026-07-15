const moteuService = require('../../services/moteurimmo.service');
const db = require('../../models');

const BATCH_SIZE = 100;    // API maxLength for includedIds
const MAX_PER_RUN = 10000;  // Max listings to check in a single cron run

async function createTimelineIfNeeded(propertyId, userId, type, meta = {}) {
  try {
    const last = await db.timeline.findOne({ propertyId, type }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    if (last) {
      const lastMeta = last.meta || {};
      const sameMeta = JSON.stringify(lastMeta) === JSON.stringify(meta);
      const lastCreated = last.createdAt || (last._id && last._id.getTimestamp && last._id.getTimestamp());
      const ageMs = lastCreated ? (now - new Date(lastCreated)) : 999999999;
      const ageHours = ageMs / (1000 * 60 * 60);
      if (sameMeta && ageHours < 24) return null;
    }
    await db.timeline.create({ propertyId, addedBy: userId, type, meta });
  } catch (err) {
    console.warn('Failed to create timeline', err && err.message ? err.message : err);
  }
}

async function checkStatusBatch() {
  const sysUser = await db.users.findOne({ email: 'system_anyhomes_importer@anyhomes.local' });
  const userId = sysUser ? sysUser._id : null;
  if (!userId) {
    console.warn('MoteurImmo statusCheck: system_anyhomes_importer user not found');
    return;
  }

  // Use aggregation to get active MoteurImmo listings with their property data (avoids heavy populate)
  // Only include listings with valid 24-char hex sourceId (actual MoteurImmo uniqueId, not test data)
  const active = await db.externalListing.aggregate([
    { $match: { source: 'moteurimmo', sourceId: { $regex: /^[a-f0-9]{24}$/ } } },
    { $lookup: { from: 'properties', localField: 'propertyId', foreignField: '_id', as: 'prop' } },
    { $unwind: { path: '$prop', preserveNullAndEmptyArrays: false } },
    { $match: { 'prop.importBy': 'platform', 'prop.propertyType': { $in: ['sale', 'rent'] } } },
    { $sort: { createdAt: -1 } },
    { $limit: MAX_PER_RUN },
    { $project: {
        _id: 1, sourceId: 1, raw: 1, status: 1, createdAt: 1,
        'prop._id': 1, 'prop.price': 1, 'prop.propertyTitle': 1, 'prop.propertyType': 1,
        'prop.images': 1,
    }},
  ]);

  if (active.length === 0) {
    console.log('MoteurImmo statusCheck: no active listings to check');
    return 0;
  }

  console.log(`MoteurImmo statusCheck: checking ${active.length} listings (max per run: ${MAX_PER_RUN})`);

  let changed = 0;
  for (let i = 0; i < active.length; i += BATCH_SIZE) {
    const batch = active.slice(i, i + BATCH_SIZE);
    const ids = batch.map(el => el.sourceId).filter(Boolean);
    if (ids.length === 0) continue;

    try {
      const data = await moteuService.fetchListings({
        includedIds: ids,
        maxLength: ids.length,
        withCount: false,
      });

      const apiAds = (data && Array.isArray(data.ads)) ? data.ads : [];
      const apiMap = {};
      for (const ad of apiAds) {
        apiMap[ad.uniqueId] = ad;
      }

      for (const el of batch) {
        const prop = el.prop;
        const ad = apiMap[el.sourceId];

        // ── ARCHIVE si l'API indique une deletionDate ──
        const shouldArchive = ad && ad.deletionDate != null;
        if (shouldArchive && prop && prop.propertyType !== 'directory') {
          const lastPrice = prop.price;
          const agencyName = el.raw?.publisher?.name || null;
          const options = ad.options || [];
          let reason = 'removed';
          if (options.includes('isSoldRented')) reason = 'soldRented';
          else if (options.includes('isUnderCompromise')) reason = 'underCompromise';

          await db.property.updateOne(
            { _id: prop._id },
            { $set: { propertyType: 'directory', updatedAt: new Date() } }
          );
          await db.externalListing.updateOne(
            { _id: el._id },
            { $set: { status: 'inactive', lastSyncAt: new Date(), raw: ad } }
          );

          await createTimelineIfNeeded(prop._id, userId, 'moteurimmoLeavingMarket', {
            reason, lastPrice, agencyName, statusBadge: 'directory',
          });

          console.log(`  [ARCHIVED] ${prop._id} — ${prop.propertyTitle?.substring(0, 60)} — reason: ${reason} — agency: ${agencyName || 'N/A'}`);
          changed++;
          continue;
        }

        // Si l'annonce n'est plus remontée par l'API, on ignore
        if (!ad || !prop) continue;

        let listingChanged = false;

        // ── PRIX ──
        const newPrice = ad.price != null ? Number(ad.price) : null;
        if (newPrice != null && prop.price != null && newPrice !== Number(prop.price)) {
          await db.property.updateOne(
            { _id: prop._id },
            { $set: { price: newPrice, updatedAt: new Date() } }
          );
          await createTimelineIfNeeded(prop._id, userId, 'priceChanged', {
            old: Number(prop.price),
            new: newPrice,
          });
          console.log(`  [PRICE] ${prop._id} — ${(prop.propertyTitle || '').substring(0, 30)}: ${prop.price} → ${newPrice}`);
          changed++;
          listingChanged = true;
        }

        // ── STATUT ──
        const apiStatus = ad.type || ad.status || ad.publicationStatus || null;
        const currentStatus = el.status || null;
        if (apiStatus && currentStatus && apiStatus !== currentStatus) {
          await createTimelineIfNeeded(prop._id, userId, 'statusChanged', {
            from: currentStatus,
            to: apiStatus,
          });
          await db.externalListing.updateOne(
            { _id: el._id },
            { $set: { status: apiStatus, lastSyncAt: new Date() } }
          );
          console.log(`  [STATUS] ${prop._id} — ${(prop.propertyTitle || '').substring(0, 30)}: ${currentStatus} → ${apiStatus}`);
          changed++;
          listingChanged = true;
        }

        // ── PHOTOS ──
        const apiImages = (() => {
          const raw = ad.pictureUrls || ad.pictureUrl || ad.images || [];
          return Array.isArray(raw) ? raw : (raw ? [raw] : []);
        })();
        const existingUrls = (prop.images || []).map(i => i.originalname || i.fileName || '').filter(Boolean);
        const newImages = apiImages.filter(u => !existingUrls.includes(u)).slice(0, 8);
        if (newImages.length > 0) {
          for (const imgUrl of newImages) {
            await db.property.updateOne(
              { _id: prop._id },
              { $push: { images: { file: imgUrl, originalname: imgUrl, status: 'queued' } } }
            );
            try {
              await db.mediaJob.create({ propertyId: prop._id, externalListingId: el._id, originalUrl: imgUrl });
            } catch (err) {
              console.warn('Failed creating mediaJob for', imgUrl, err && err.message);
            }
          }
          await createTimelineIfNeeded(prop._id, userId, 'photosAdded', { count: newImages.length });
          console.log(`  [PHOTOS] ${prop._id} — ${(prop.propertyTitle || '').substring(0, 30)}: ${newImages.length} new photos`);
          changed++;
          listingChanged = true;
        }

        // Mise à jour lastSyncAt systématiquement + raw si changement détecté
        const elUpdates = { lastSyncAt: new Date() };
        if (listingChanged) elUpdates.raw = ad;
        await db.externalListing.updateOne({ _id: el._id }, { $set: elUpdates });
      }
    } catch (err) {
      console.error(`MoteurImmo statusCheck batch error at index ${i}:`, err.message);
    }
  }

  console.log(`MoteurImmo statusCheck done: ${changed} properties changed/archived this run`);
  return changed;
}

module.exports = { checkStatusBatch };
