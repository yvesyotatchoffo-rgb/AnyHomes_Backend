const crypto = require('crypto');
const axios = require('axios');

async function geocodeAddress({ city, postalCode, country }) {
  const qParts = [];
  if (postalCode) qParts.push(postalCode);
  if (city) qParts.push(city);
  if (country) qParts.push(country);
  const q = qParts.join(', ');
  if (!q) return null;

  const apiKey = process.env.GEOCODING_API_KEY;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (apiKey) {
        const res = await axios.get('https://api.opencagedata.com/geocode/v1/json', { params: { q, key: apiKey, limit: 1 } });
        const r = res && res.data && Array.isArray(res.data.results) && res.data.results[0];
        if (r && r.geometry && typeof r.geometry.lat === 'number' && typeof r.geometry.lng === 'number') {
          console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', message: 'geocode.success', provider: 'opencage', q, attempt }));
          return { lat: r.geometry.lat, lon: r.geometry.lng };
        }
      } else {
        const res = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: { q, format: 'json', limit: 1, addressdetails: 0 },
          headers: { 'User-Agent': process.env.GEOCODING_USER_AGENT || 'anyhomes-geocoder/1.0' },
          timeout: 10000,
        });
        const r = res && Array.isArray(res.data) && res.data[0];
        if (r && r.lat && r.lon) {
          console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', message: 'geocode.success', provider: 'nominatim', q, attempt }));
          return { lat: Number(r.lat), lon: Number(r.lon) };
        }
      }
      // if no result, break early
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', message: 'geocode.noresult', q, attempt }));
      break;
    } catch (err) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', message: 'geocode.error', q, attempt, err: err && err.message }));
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, Math.min(5000, 1000 * Math.pow(2, attempt - 1))));
    }
  }
  return null;
}

async function normalizeListing(raw) {
  const dto = {};
  if (!raw || typeof raw !== 'object') {
    dto.source = 'moteurimmo';
    dto.sourceId = null;
    dto.propertyTitle = typeof raw === 'string' ? raw.slice(0, 120) : 'Imported from MoteurImmo (raw)';
    dto.content = typeof raw === 'string' ? raw : '';
    dto.images = [];
    dto.external = raw;
    dto.timestamps = {};
    return dto;
  }
  dto.source = 'moteurimmo';
  dto.url = raw.url || null;
  dto.sourceId = raw.uniqueId || raw.unique_id || raw.id || raw.adId || null;
  dto.reference = raw.reference || raw.adId || raw.id || null;

  // ensure stable sourceId: if missing, hash a stable key (url or origin+adId+reference)
  if (!dto.sourceId) {
    const key = dto.url || (raw && ((raw.origin || '') + '::' + (raw.adId || '') + '::' + (raw.reference || '')));
    if (key) {
      try {
        dto.sourceId = crypto.createHash('sha1').update(String(key)).digest('hex');
      } catch (e) {
        dto.sourceId = null;
      }
    }
  }

  dto.propertyTitle = raw.title || raw.headline || '';
  dto.name = dto.propertyTitle;
  dto.content = raw.description || raw.body || '';
  // Convert plain text newlines to HTML for frontend display
  if (dto.content && !dto.content.includes('<')) {
    dto.content = dto.content
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    dto.content = '<p>' + dto.content + '</p>';
  }

  dto.price = raw.price != null ? Number(raw.price) : (raw.rent != null ? Number(raw.rent) : (raw.originalPrice != null ? Number(raw.originalPrice) : null));
  dto.originalPrice = raw.originalPrice != null ? Number(raw.originalPrice) : null;

  dto.area = raw.surface || raw.livingArea || raw.area || null;
  dto.surface = raw.surface || raw.livingArea || raw.area || null;
  dto.rooms = raw.rooms || raw.nbRooms || null;
  dto.bedrooms = raw.bedrooms || null;
  dto.bathrooms = raw.baths || raw.bathrooms || raw.bathroom || null;
  dto.propertyCharges = raw.propertyCharges || null;
  dto.floor = raw.floor || raw.level || null;
  dto.livingRoom = raw.livingRoom || raw.living_room || raw.livingRoomCount || null;
  dto.buildingYear = raw.yearBuilt || raw.buildingYear || raw.constructionYear || null;
  dto.propertyMonthlyCharges = raw.monthlyCharges || raw.propertyMonthlyCharges || raw.maintenanceCharges || raw.rent || null;
  dto.guaranteeDeposit = raw.guaranteeDeposit || raw.securityDeposit || null;
  dto.propertyInventory = raw.propertyInventory || null;

  dto.address = raw.address || (raw.location && raw.location.address) || null;
  dto.zipcode = raw.postalCode || raw.zipcode || (raw.location && (raw.location.postalCode || raw.location.zipcode)) || null;
  dto.city = raw.city || raw.town || (raw.location && (raw.location.city || raw.location.town || raw.location.locality)) || null;
  dto.state = (raw.location && (raw.location.state || raw.location.region || raw.location.department)) || raw.region || raw.department || null;
  dto.country = raw.country || (raw.location && raw.location.country) || 'France';
  dto.propertyTypeRaw = raw.transactionType || raw.listingType || raw.adType || raw.offerType || raw.propertyType || raw.type || '';
  dto.propertyKind = raw.propertyKind || raw.category || raw.subtype || raw.type || null;
  dto.category = (raw.category || '').toLowerCase();

  dto.email = (raw.publisher && (raw.publisher.email || raw.publisher.contactEmail)) || raw.contactEmail || null;
  dto.featured = raw.featured != null ? Boolean(raw.featured) : (raw.isFeatured != null ? Boolean(raw.isFeatured) : false);
  dto.agency = (raw.publisher && (raw.publisher.agencyId || raw.publisher.id || raw.publisher._id)) || raw.agentId || raw.agencyId || null;
  dto.publisher = raw.publisher || null;
  dto.publisherType = raw.publisher && raw.publisher.type ? raw.publisher.type : (raw.publisherType || null);
  dto.publisherPhone = (raw.publisher && raw.publisher.phone) || raw.agentPhone || null;

  dto.addedBy = raw.addedBy || null;
  dto.importBy = raw.importBy || 'platform';
  dto.isDeleted = raw.isDeleted != null ? Boolean(raw.isDeleted) : false;
  dto.offMarket = raw.offMarket != null ? Boolean(raw.offMarket) : false;

  dto.pricePerSquareMeter = raw.pricePerSquareMeter != null ? Number(raw.pricePerSquareMeter) : null;
  dto.priceStats = raw.priceStats || null;
  dto.history = Array.isArray(raw.history) ? raw.history : null;
  dto.landSurface = raw.landSurface != null ? Number(raw.landSurface) : null;
  dto.creationDate = raw.creationDate || null;
  dto.publicationDate = raw.publicationDate || null;
  dto.deletionDate = raw.deletionDate || null;
  dto.lastCheckDate = raw.lastCheckDate || null;
  dto.lastEventDate = raw.lastEventDate || null;
  dto.lastChangeDate = raw.lastChangeDate || null;
  dto.lastModificationDate = raw.lastModificationDate || null;
  dto.lastPriceChangeDate = raw.lastPriceChangeDate || null;
  dto.lastPublicationDate = raw.lastPublicationDate || null;
  dto.transactionTypeSource = raw.transactionType || raw.listingType || raw.adType || raw.offerType || null;
  dto.inseeCode = (raw.location && raw.location.inseeCode) || raw.inseeCode || null;
  dto.departmentCode = (raw.location && raw.location.departmentCode) || raw.departmentCode || null;
  dto.regionCode = (raw.location && raw.location.regionCode) || raw.regionCode || null;

  dto.chooseDocumentGrade = raw.chooseDocumentGrade || raw.documentGrade || null;
  dto.isChoosedDocumentVerified = raw.isChoosedDocumentVerified != null ? Boolean(raw.isChoosedDocumentVerified) : false;
  dto.isChoosedDeclDocumentVerified = raw.isChoosedDeclDocumentVerified != null ? Boolean(raw.isChoosedDeclDocumentVerified) : false;
  dto.maximumLead = raw.maximumLead != null ? String(raw.maximumLead) : null;

  dto.dateOfDiagnosis = raw.energyDiagnosisDate || raw.diagnosticDate || null;
  dto.diagnosisType = raw.diagnosticType || raw.energyDiagnosisType || null;
  dto.energyConsumption = raw.energyConsumption || raw.dpeValue || null;
  dto.energy_efficient = raw.energyEfficiency || raw.eepClass || null;
  dto.emission_efficient = raw.emissionEfficiency || raw.ghgClass || null;
  dto.emissions = raw.emissions || raw.ghgValue || null;
  dto.diagnosisDate = raw.diagnosticDate || raw.energyDiagnosisDate || null;

  dto.contact = raw.contactAllowed != null ? Boolean(raw.contactAllowed) : (raw.contact != null ? Boolean(raw.contact) : false);
  dto.transparency = raw.transparency != null ? Boolean(raw.transparency) : false;
  dto.username = (raw.publisher && raw.publisher.name) || raw.agentName || null;
  dto.phoneNumber = (raw.publisher && raw.publisher.phone) || raw.agentPhone || null;
  dto.usedAs = raw.usedAs || raw.useType || null;
  dto.propertyAgencyFees = raw.agencyFees || raw.serviceFees || null;

  dto.sale_my_property = raw.sale_my_property != null ? Boolean(raw.sale_my_property) : false;
  dto.real_estate_market = raw.real_estate_market != null ? Boolean(raw.real_estate_market) : false;
  dto.add_more_step = raw.add_more_step != null ? Boolean(raw.add_more_step) : false;

  dto.revenue_detail = raw.rentalRevenue || raw.revenueDetails || null;
  dto.renovation_work = raw.renovationHistory || raw.renovationWork || null;
  dto.rating = raw.rating || raw.reviewScore || null;
  dto.Expenses = raw.expenses || raw.costs || null;

  dto.searchType = raw.searchType || null;
  dto.proposal = raw.proposal || raw.offerType || null;

  dto.favoriteCount = raw.favoriteCount != null ? Number(raw.favoriteCount) : null;
  dto.externalUrl = raw.url || raw.externalUrl || null;
  dto.ownerId = raw.ownerId || null;

  // location / coordinates (robust handling and lat/lon swap detection)
  dto.location = raw.location || raw.address || null;
  let pos = null;
  if (raw.position && Array.isArray(raw.position) && raw.position.length >= 2) pos = raw.position;
  else if (raw.location && Array.isArray(raw.location.coordinates) && raw.location.coordinates.length >= 2) pos = raw.location.coordinates;
  else if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) pos = raw.coordinates;

  if (pos && Array.isArray(pos) && pos.length >= 2) {
    const a = Number(pos[0]);
    const b = Number(pos[1]);
    // If values look like [lat, lon] (lat in [-90,90], lon in [-180,180]) swapped, correct to [lon, lat]
    const aIsLat = a >= -90 && a <= 90 && (b < -90 || b > 90);
    const bIsLat = b >= -90 && b <= 90 && (a < -90 || a > 90);
    let lon = a;
    let lat = b;
    if (aIsLat && !bIsLat) {
      // pos was [lat, lon]
      lon = b;
      lat = a;
    }
    // final sanity clamp: if values are out of bounds, skip
    if (lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
      dto.position = { type: 'Point', coordinates: [Number(lon), Number(lat)] };
    }
  } else if (raw.latitude != null && raw.longitude != null) {
    dto.position = { type: 'Point', coordinates: [Number(raw.longitude), Number(raw.latitude)] };
  }

  // If no position found but we have city/postal/country, try geocoding (optional)
  if (!dto.position) {
    const city = (dto.location && (dto.location.city || dto.location.town || dto.location.locality)) || raw.city || raw.town || null;
    const postal = (dto.location && (dto.location.postalCode || dto.location.zipcode)) || raw.postalCode || raw.zipcode || raw.postal || null;
    const country = (dto.location && dto.location.country) || raw.country || 'France';
    if (city || postal) {
      const coords = await geocodeAddress({ city, postalCode: postal, country });
      if (coords) dto.position = { type: 'Point', coordinates: [Number(coords.lon), Number(coords.lat)] };
    }
  }

  // images
  const imgs = raw.pictureUrls || raw.pictureUrl || raw.images || [];
  dto.images = Array.isArray(imgs) ? imgs.slice(0, 50) : (imgs ? [imgs] : []);

  dto.origin = raw.origin || null;
  dto.adId = raw.adId || raw.ad_id || null;
  dto.url = raw.url || null;
  dto.options = Array.isArray(raw.options) ? raw.options : [];

  dto.listingStatus = raw.type || raw.status || raw.publicationStatus || null;

  dto.history = Array.isArray(raw.history)
    ? raw.history.map(h => (h && typeof h === 'object' ? { ...h } : h))
    : [];

  dto.external = raw; // keep raw for audit

  dto.timestamps = {
    creationDate: raw.creationDate || raw.publicationDate || null,
    publicationDate: raw.publicationDate || null,
    lastUpdate: raw.lastModificationDate || raw.lastChangeDate || null,
    deletionDate: raw.deletionDate || null,
  };

  return dto;
}

module.exports = { normalizeListing };
