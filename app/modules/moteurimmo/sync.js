const moteuService = require('../../services/moteurimmo.service');
const { normalizeListing } = require('./normalizer');
const db = require('../../models');
const config = require('../../config/moteurimmo.config');
const { sendEmail } = require('../../config/brevo.config');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');

async function ensureUploads() {
  const uploads = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
  return uploads;
}

async function downloadImage(url, destFolder) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('data:')) return null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'debug', message: 'downloadImage.attempt', url, attempt }));
      const res = await moteuService.client.get(url, { responseType: 'stream', timeout: 20000 });
      const rawName = path.basename(url.split('?')[0]) || 'img';
      const fileName = `${Date.now()}_${sanitize(rawName)}`;
      const destPath = path.join(destFolder, fileName);
      const writer = fs.createWriteStream(destPath);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', message: 'downloadImage.success', url, destPath }));
      return destPath;
    } catch (err) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', message: 'downloadImage.error', url, attempt, err: err && err.message }));
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, Math.min(5000, 1000 * Math.pow(2, attempt - 1))));
    }
  }
  return null;
}

async function createTimelineIfNeeded(propertyId, userId, type, meta = {}) {
  try {
    // prevent duplicate events: check latest event for this property+type
    const last = await db.timeline.findOne({ propertyId, type }).sort({ createdAt: -1 }).lean();
    const now = new Date();
    if (last) {
      // if same meta and recent (within 24h), skip
      const lastMeta = last.meta || {};
      const sameMeta = JSON.stringify(lastMeta) === JSON.stringify(meta);
      const lastCreated = last.createdAt || (last._id && last._id.getTimestamp && last._id.getTimestamp());
      const ageMs = lastCreated ? (now - new Date(lastCreated)) : 999999999;
      const ageHours = ageMs / (1000 * 60 * 60);
      if (sameMeta && ageHours < 24) {
        return null; // duplicate
      }
      // special-case price: if last.newPrice equals meta.new, skip
      if (type === 'priceChanged' || type === 'newPrice') {
        const lastNew = last.newPrice || (last.meta && (last.meta.new || last.meta.newPrice));
        const newVal = meta && (meta.new || meta.newPrice || meta.new_price) || null;
        if (lastNew != null && newVal != null && Number(lastNew) === Number(newVal)) return null;
      }
    }

    const payload = { propertyId, addedBy: userId, type, meta };
    if (type === 'priceChanged' && meta && (meta.old != null || meta.new != null)) {
      payload.oldPrice = meta.old != null ? Number(meta.old) : undefined;
      payload.newPrice = meta.new != null ? Number(meta.new) : undefined;
    }

    await db.timeline.create(payload);
  } catch (err) {
    console.warn('Failed to create timeline', err && err.message ? err.message : err);
  }
}

function inferPropertyType(rawType) {
  const normalized = String(rawType || '').toLowerCase();
  if (!normalized) return 'sale';
  if (/rent|location|rental|locatif|loué|bail/.test(normalized)) return 'rent';
  if (/directory|annonce|listing/.test(normalized)) return 'directory';
  return 'sale';
}

function inferPropertyKind(kindText) {
  const normalized = String(kindText || '').toLowerCase();
  if (/house|maison|villa/.test(normalized)) return 'house';
  if (/castle|chateau/.test(normalized)) return 'castle';
  if (/farm|ferme/.test(normalized)) return 'farm';
  if (/building|immeuble/.test(normalized)) return 'building';
  return 'apartment';
}

/**
 * Detect if a listing does NOT correspond to an existing property (land, off-plan, etc.)
 * Only matches unambiguous patterns to avoid false positives (e.g. houses that happen
 * to have "constructible" land or "terrain à vendre" as a feature).
 */
function isNonExistingProperty(dto) {
  const title = (dto.propertyTitle || '').toLowerCase().trim();
  const content = (dto.content || '').toLowerCase().replace(/<[^>]+>/g, ' ');

  // Patterns in title indicating land, off-plan, or construction packages.
  // Avoid: "constructible" alone (matches houses on building land),
  //        "terrain à vendre" (matches "maison avec terrain à vendre"),
  //        "lotissement" (matches houses in housing developments).
  const titlePatterns = [
    /^terrain\b/,
    /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu|plat)\b/,
    /\bterrain\s*[+&]\s*maison\b/,
    /\b(à|a)\s*bâtir\b/,
    /\bsur\s*plan\b/,
    /\bvefa\b/,
    /\bprogramme\s+neuf\b/,
    /\brésidence\s+neuve\b/,
    /\bvente\s+en\s+l['\u2019]?état\s+futur\b/,
    /\bterrain\s+avec\s+(?:pc|permis)\b/,
  ];

  for (const pattern of titlePatterns) {
    if (pattern.test(title)) return true;
  }

  // Patterns in content — only for unambiguous land indicators
  const contentPatterns = [
    /\bterrain\s+(à\s?bâtir|a\s?batir|constructible|nu)\b/,
    /\bvente\s+en\s+l['\u2019]?état\s+futur\b/,
  ];

  for (const pattern of contentPatterns) {
    if (pattern.test(content)) return true;
  }

  // If the first ~100 chars of clean content describe a land plot (not an existing building)
  const firstChars = content.replace(/<[^>]+>/g, ' ').trim().slice(0, 100).toLowerCase();
  if (/^(?:beau|joli|grand|magnifique|superbe)?\s*terrain\b/.test(firstChars)) {
    return true;
  }

  return false;
}

function inferPropertyStatus(listingStatus) {
  const normalized = String(listingStatus || '').toLowerCase();
  if (/sold|inactive|archived|unavailable|deleted|removed|cancelled|cancelled/.test(normalized)) return 'inactive';
  return 'active';
}

function buildPropertyPayload(dto, userId) {
  // If the listing has a deletionDate, it's no longer on the market → import as directory
  const inferredType = inferPropertyType(dto.propertyTypeRaw || dto.listingStatus);
  const propertyType = dto.deletionDate ? 'directory' : inferredType;
  const propertyKind = inferPropertyKind(dto.propertyKind || dto.propertyTitle || dto.origin || dto.listingStatus);

  return {
    name: dto.propertyTitle || 'Imported from MoteurImmo',
    propertyTitle: dto.propertyTitle || 'Imported from MoteurImmo',
    content: dto.content || '',
    price: dto.price != null ? Number(dto.price) : null,
    originalPrice: dto.originalPrice != null ? Number(dto.originalPrice) : null,
    area: dto.surface != null ? String(dto.surface) : undefined,
    surface: dto.surface != null ? String(dto.surface) : undefined,
    rooms: dto.rooms != null ? String(dto.rooms) : undefined,
    bedrooms: dto.bedrooms != null ? String(dto.bedrooms) : undefined,
    bathroom: dto.bathrooms != null ? String(dto.bathrooms) : undefined,
    livingRoom: dto.livingRoom != null ? String(dto.livingRoom) : undefined,
    propertyFloor: dto.floor != null ? String(dto.floor) : undefined,
    address: dto.address || null,
    zipcode: dto.zipcode || null,
    city: dto.city || null,
    state: dto.state || undefined,
    country: dto.country || 'France',
    newlocation: dto.position || (dto.location && Array.isArray(dto.location.coordinates) ? { type: 'Point', coordinates: [Number(dto.location.coordinates[0]) || 0, Number(dto.location.coordinates[1]) || 0] } : { type: 'Point', coordinates: [0, 0] }),
    location: dto.location || undefined,
    email: dto.email || undefined,
    images: [],
    featured: dto.featured === true,
    agency: dto.agency || undefined,
    propertyType,
    type: propertyKind,
    status: inferPropertyStatus(dto.listingStatus),
    addedBy: dto.addedBy || userId,
    importBy: dto.importBy || 'platform',
    isDeleted: dto.isDeleted === true,
    offMarket: dto.offMarket === true,
    chooseDocumentGrade: dto.chooseDocumentGrade || undefined,
    isChoosedDocumentVerified: dto.isChoosedDocumentVerified === true,
    isChoosedDeclDocumentVerified: dto.isChoosedDeclDocumentVerified === true,
    maximumLead: dto.maximumLead || undefined,
    dateOfDiagnosis: dto.dateOfDiagnosis || undefined,
    diagnosisType: dto.diagnosisType || undefined,
    energyConsumption: dto.energyConsumption || undefined,
    energy_efficient: dto.energy_efficient || undefined,
    emission_efficient: dto.emission_efficient || undefined,
    emissions: dto.emissions || undefined,
    diagnosisDate: dto.diagnosisDate || undefined,
    contact: dto.contact === true,
    transparency: dto.transparency === true,
    username: dto.username || undefined,
    phoneNumber: dto.phoneNumber || undefined,
    usedAs: dto.usedAs || undefined,
    propertyAgencyFees: dto.propertyAgencyFees != null ? Number(dto.propertyAgencyFees) : undefined,
    sale_my_property: dto.sale_my_property === true,
    real_estate_market: dto.real_estate_market === true,
    add_more_step: dto.add_more_step === true,
    revenue_detail: Array.isArray(dto.revenue_detail) ? dto.revenue_detail : undefined,
    renovation_work: Array.isArray(dto.renovation_work) ? dto.renovation_work : undefined,
    rating: Array.isArray(dto.rating) ? dto.rating : undefined,
    Expenses: Array.isArray(dto.Expenses) ? dto.Expenses : undefined,
    searchType: dto.searchType || undefined,
    proposal: dto.proposal || undefined,
    favoriteCount: dto.favoriteCount != null ? Number(dto.favoriteCount) : undefined,
    externalUrl: dto.externalUrl || undefined,
    publisher: dto.publisher || undefined,
    publisherType: dto.publisherType || undefined,
    publisherPhone: dto.publisherPhone || undefined,
    pricePerSquareMeter: dto.pricePerSquareMeter != null ? Number(dto.pricePerSquareMeter) : undefined,
    priceStats: dto.priceStats || undefined,
    history: Array.isArray(dto.history) ? dto.history : undefined,
    landSurface: dto.landSurface != null ? Number(dto.landSurface) : undefined,
    creationDate: dto.creationDate ? new Date(dto.creationDate) : undefined,
    publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
    deletionDate: dto.deletionDate ? new Date(dto.deletionDate) : undefined,
    lastCheckDate: dto.lastCheckDate ? new Date(dto.lastCheckDate) : undefined,
    lastEventDate: dto.lastEventDate ? new Date(dto.lastEventDate) : undefined,
    lastChangeDate: dto.lastChangeDate ? new Date(dto.lastChangeDate) : undefined,
    lastModificationDate: dto.lastModificationDate ? new Date(dto.lastModificationDate) : undefined,
    lastPriceChangeDate: dto.lastPriceChangeDate ? new Date(dto.lastPriceChangeDate) : undefined,
    lastPublicationDate: dto.lastPublicationDate ? new Date(dto.lastPublicationDate) : undefined,
    transactionTypeSource: dto.transactionTypeSource || undefined,
    inseeCode: dto.inseeCode || undefined,
    departmentCode: dto.departmentCode || undefined,
    regionCode: dto.regionCode || undefined,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
    propertyMonthlyCharges: dto.propertyMonthlyCharges != null ? Number(dto.propertyMonthlyCharges) : undefined,
    guaranteeDeposit: dto.guaranteeDeposit != null ? Number(dto.guaranteeDeposit) : undefined,
    propertyInventory: dto.propertyInventory != null ? Number(dto.propertyInventory) : undefined,
    building: dto.buildingYear || undefined,
  };
}

async function upsertListing(raw) {
  const dto = await normalizeListing(raw);
  console.log('DEBUG upsertListing dto summary:', {
    sourceId: dto.sourceId,
    adId: dto.adId,
    reference: dto.reference,
    title: dto.propertyTitle && dto.propertyTitle.slice(0,80),
    price: dto.price,
    images: (dto.images||[]).length,
  });
  const source = 'moteurimmo';
  // prefer explicit sourceId (normalizer now ensures a stable SHA1 fallback when possible)
  const sourceId = dto.sourceId || null;
  if (!sourceId) {
    console.warn('No stable sourceId available for listing; skipping import');
    return null;
  }

  // Skip non-residential categories (office, premises, shop, block, land, parking/garage/box, misc)
  const RESIDENTIAL_CATEGORIES = ['house', 'flat'];
  const adCategory = dto.category || '';
  if (!RESIDENTIAL_CATEGORIES.includes(adCategory)) {
    console.log(`  [SKIP] Non-residential category "${adCategory}" for "${(dto.propertyTitle || '').slice(0, 60)}"`);
    return null;
  }

  // Skip listings that are not existing properties (land, off-plan, etc.)
  if (isNonExistingProperty(dto)) {
    console.log(`  [SKIP] Non-existing property (land/off-plan) for "${(dto.propertyTitle || '').slice(0, 60)}"`);
    return null;
  }

  let existing = await db.externalListing.findOne({ source, sourceId });

  const sysUser = await db.users.findOne({ email: 'system_anyhomes_importer@anyhomes.local' });
  const userId = sysUser ? sysUser._id : null;

  if (existing && existing.propertyId) {
    const prop = await db.property.findById(existing.propertyId);
    if (prop) {
      const updates = {};
      if (dto.price != null && dto.price !== prop.price) updates.price = dto.price;
      if (dto.propertyTitle && dto.propertyTitle !== prop.propertyTitle) updates.propertyTitle = dto.propertyTitle;
      if (dto.content && dto.content !== prop.content) updates.content = dto.content;
      if (dto.surface && String(dto.surface) !== String(prop.surface)) updates.surface = String(dto.surface);
      if (dto.rooms != null && String(dto.rooms) !== String(prop.rooms)) updates.rooms = String(dto.rooms);
      if (dto.bedrooms != null && String(dto.bedrooms) !== String(prop.bedrooms)) updates.bedrooms = String(dto.bedrooms);
      if (dto.bathrooms != null && String(dto.bathrooms) !== String(prop.bathroom)) updates.bathroom = String(dto.bathrooms);
      if (dto.floor != null && String(dto.floor) !== String(prop.propertyFloor)) updates.propertyFloor = String(dto.floor);
      if (dto.livingRoom != null && String(dto.livingRoom) !== String(prop.livingRoom)) updates.livingRoom = String(dto.livingRoom);
      if (dto.address && dto.address !== prop.address) updates.address = dto.address;
      if (dto.zipcode && dto.zipcode !== prop.zipcode) updates.zipcode = dto.zipcode;
      if (dto.city && dto.city !== prop.city) updates.city = dto.city;
      if (dto.state && dto.state !== prop.state) updates.state = dto.state;
      if (dto.country && dto.country !== prop.country) updates.country = dto.country;
      if (dto.email && dto.email !== prop.email) updates.email = dto.email;
      if (dto.featured !== undefined && dto.featured !== prop.featured) updates.featured = dto.featured;
      if (dto.offMarket != null && dto.offMarket !== prop.offMarket) updates.offMarket = dto.offMarket;
      if (dto.isDeleted != null && dto.isDeleted !== prop.isDeleted) updates.isDeleted = dto.isDeleted;
      if (dto.propertyMonthlyCharges != null && Number(dto.propertyMonthlyCharges) !== prop.propertyMonthlyCharges) updates.propertyMonthlyCharges = Number(dto.propertyMonthlyCharges);
      if (dto.propertyCharges != null && Number(dto.propertyCharges) !== prop.propertyCharges) updates.propertyCharges = Number(dto.propertyCharges);
      if (dto.guaranteeDeposit != null && Number(dto.guaranteeDeposit) !== prop.guaranteeDeposit) updates.guaranteeDeposit = Number(dto.guaranteeDeposit);
      if (dto.propertyInventory != null && Number(dto.propertyInventory) !== prop.propertyInventory) updates.propertyInventory = Number(dto.propertyInventory);
      if (dto.externalUrl && dto.externalUrl !== prop.externalUrl) updates.externalUrl = dto.externalUrl;
      if (dto.favoriteCount != null && Number(dto.favoriteCount) !== prop.favoriteCount) updates.favoriteCount = Number(dto.favoriteCount);
      if (dto.searchType && dto.searchType !== prop.searchType) updates.searchType = dto.searchType;
      if (dto.proposal && dto.proposal !== prop.proposal) updates.proposal = dto.proposal;
      if (dto.position) updates.newlocation = dto.position;
      const newType = inferPropertyKind(dto.propertyKind || dto.propertyTitle || dto.origin || dto.listingStatus);
      if (newType && newType !== prop.type) updates.type = newType;
      const inferredPT = inferPropertyType(dto.propertyTypeRaw || dto.listingStatus);
      const newPropertyType = dto.deletionDate ? 'directory' : inferredPT;
      if (newPropertyType && newPropertyType !== prop.propertyType) updates.propertyType = newPropertyType;
      const mappedStatus = inferPropertyStatus(dto.listingStatus);
      if (mappedStatus !== prop.status) updates.status = mappedStatus;
      if (Object.keys(updates).length) {
        updates.updatedAt = new Date();
        await db.property.updateOne({ _id: prop._id }, { $set: updates });
        if (updates.price != null) {
          await createTimelineIfNeeded(prop._id, userId, 'priceChanged', { old: prop.price, new: updates.price });
          console.log('Price changed for', prop._id, 'from', prop.price, 'to', updates.price);
        }
      }

      // images: create queued media jobs for any new images (frontend can use originalUrl immediately)
      const existingImages = (prop.images || []).map(i => i.originalname || i.fileName || '').filter(Boolean);
      const newImgs = (dto.images || []).filter(u => !existingImages.includes(u)).slice(0, 8);
      if (newImgs.length) {
        for (let imgUrl of newImgs) {
          // push a placeholder into property.images so front can display originalUrl immediately
          await db.property.updateOne({ _id: prop._id }, { $push: { images: { file: imgUrl, originalname: imgUrl, status: 'queued' } } });
          try {
            await db.mediaJob.create({ propertyId: prop._id, externalListingId: existing._id, originalUrl: imgUrl });
          } catch (err) {
            console.warn('Failed creating mediaJob for', imgUrl, err && err.message);
          }
        }
        await createTimelineIfNeeded(prop._id, userId, 'photosAdded', { count: newImgs.length });
        console.log('Queued', newImgs.length, 'photos for download for', prop._id);
      }
      // detect status changes
      const prevStatus = existing.status || null;
      const newStatus = dto.listingStatus || existing.status || null;
      if (prevStatus !== newStatus) {
        await createTimelineIfNeeded(prop._id, userId, 'statusChanged', { from: prevStatus, to: newStatus });
        console.log('Status changed for', prop._id, 'from', prevStatus, 'to', newStatus);
      }

      existing.raw = dto.external;
      existing.status = newStatus;
      existing.lastSyncAt = new Date();
      await existing.save();
      return prop._id;
    }
  }

  // create new property when none exists
  const propData = buildPropertyPayload(dto, userId);
  if (!dto.position && propData.newlocation && Array.isArray(propData.newlocation.coordinates) && propData.newlocation.coordinates[0] === 0 && propData.newlocation.coordinates[1] === 0) {
    console.warn('propData uses fallback coordinates [0,0] for newlocation — consider improving geo mapping');
  }

  let property;
  try {
    property = await db.property.create(propData);
  } catch (err) {
    console.error('Failed creating property', err && err.message ? err.message : err, 'propData keys=', Object.keys(propData));
    throw err;
  }

  // record original image URLs and create media jobs for background download
  const imageUrls = (dto.images || []).slice(0, 10);
  if (imageUrls.length) {
    const placeholders = imageUrls.map(u => ({ file: u, originalname: u, status: 'queued' }));
    property.images = (property.images || []).concat(placeholders);
    await property.save();
    for (let imgUrl of imageUrls) {
      try {
        await db.mediaJob.create({ propertyId: property._id, externalListingId: null, originalUrl: imgUrl });
      } catch (err) {
        console.warn('Failed creating mediaJob for new property', imgUrl, err && err.message);
      }
    }
  }

  let external;
  try {
    external = await db.externalListing.create({
      source,
      sourceId,
      reference: dto.reference,
      raw: dto.external,
      propertyId: property._id,
      status: dto.listingStatus,
      lastSyncAt: new Date(),
    });
  } catch (err) {
    console.error('Failed creating externalListing', err && err.message ? err.message : err, 'sourceId=', sourceId);
    throw err;
  }

  // timeline — enriched with status, price and agency
  const inferredType = inferPropertyType(dto.propertyTypeRaw || dto.listingStatus);
  const propType = dto.deletionDate ? 'directory' : inferredType;
  await createTimelineIfNeeded(property._id, userId, 'propertyCreated', {
    source,
    sourceId,
    statusBadge: propType,
    price: dto.price,
    agencyName: (dto.publisher && dto.publisher.name) || dto.username || null,
  });

  // If the ad was already deleted when imported, record it in the timeline
  if (dto.deletionDate) {
    const opts = dto.options || [];
    let reason = 'removed';
    if (opts.includes('isSoldRented')) reason = 'soldRented';
    else if (opts.includes('isUnderCompromise')) reason = 'underCompromise';
    await createTimelineIfNeeded(property._id, userId, 'moteurimmoLeavingMarket', {
      reason,
      lastPrice: dto.price,
      agencyName: dto.publisher?.name || null,
      statusBadge: 'directory',
    });
  }

  return property._id;
}

// ── Import Run tracking ──────────────────────────────────────────────────────

async function createRun() {
  const runRef = 'MI-' + Date.now().toString(36).toUpperCase();
  return db.importRun.create({
    runRef,
    source: 'moteurimmo',
    startDate: new Date(),
    status: 'running',
  });
}

async function updateRunCounts(runId, propertyType) {
  if (!runId) return;
  const inc = { totalCount: 1 };
  if (propertyType === 'rent') inc.rentCount = 1;
  else if (propertyType === 'sale') inc.saleCount = 1;
  else inc.ignoredCount = 1;
  await db.importRun.findByIdAndUpdate(runId, { $inc: inc });
}

async function finalizeRun(runId, error) {
  if (!runId) return;
  const run = await db.importRun.findById(runId);
  if (!run) return;
  const duration = Math.round((new Date() - run.startDate) / 1000);
  const status = error ? 'failed' : 'completed';
  await db.importRun.findByIdAndUpdate(runId, {
    $set: {
      endDate: new Date(),
      duration,
      status,
      error: error || undefined,
    },
  });

  if (status === 'failed' && process.env.MOTEURIMMO_NOTIFY_EMAIL) {
    try {
      await sendEmail({
        module: 'AUTH',
        to: process.env.MOTEURIMMO_NOTIFY_EMAIL,
        subject: `[AnyHomes] Échec sync MoteurImmo — ${run.runRef}`,
        htmlContent: `<h2>Sync MoteurImmo échoué</h2>
<p>Le run <strong>${run.runRef}</strong> (source: ${run.source}) a échoué.</p>
<p><strong>Erreur :</strong> ${error || 'N/A'}</p>
<p><strong>Début :</strong> ${run.startDate?.toISOString() || 'N/A'}</p>
<p><strong>Durée :</strong> ${duration}s</p>
<p>Consultez le dashboard admin pour plus de détails.</p>`,
      });
    } catch (emailErr) {
      console.error('Failed to send failure notification email:', emailErr.message);
    }
  }
}

// ── Run with tracking ────────────────────────────────────────────────────────

async function runOnce({ page = 1, pageSize = config.defaultPageSize, maxPages = config.maxSyncPages } = {}) {
  const run = await createRun();
  const runId = run._id;
  let totalProcessed = 0;
  try {
    for (let currentPage = page; currentPage < page + maxPages; currentPage++) {
      const params = { page: currentPage, pageSize };
      const data = await moteuService.fetchListings(params);
      const listings = data && Array.isArray(data.ads) ? data.ads : [];
      if (listings.length === 0) break;
      for (let raw of listings) {
        try {
          const dto = await normalizeListing(raw);
          const propType = dto.deletionDate ? 'directory' : inferPropertyType(dto.propertyTypeRaw || dto.listingStatus);
          await upsertListing(raw);
          await updateRunCounts(runId, propType);
          totalProcessed++;
        } catch (err) {
          console.error('Error upserting listing', err && err.message ? err.message : err);
          await updateRunCounts(runId, null);
        }
      }
      console.log(`MoteurImmo sync: page ${currentPage} done (${listings.length} items, cumulative: ${totalProcessed})`);
    }
    await finalizeRun(runId);
    return totalProcessed;
  } catch (err) {
    await finalizeRun(runId, err.message);
    throw err;
  }
}

module.exports = { runOnce, upsertListing, createRun, updateRunCounts, finalizeRun };
