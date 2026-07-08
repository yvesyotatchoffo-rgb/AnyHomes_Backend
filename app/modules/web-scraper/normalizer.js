const crypto = require('crypto');

async function normalizeScrapedData(scraped) {
  const dto = {};

  dto.source = scraped.source || 'web';
  dto.url = scraped.url || null;
  dto.sourceId = scraped.sourceId || null;

  if (!dto.sourceId && dto.url) {
    try {
      dto.sourceId = crypto.createHash('sha1').update(dto.url).digest('hex');
    } catch {
      dto.sourceId = null;
    }
  }

  dto.propertyTitle = scraped.title || scraped.name || '';
  dto.name = dto.propertyTitle;
  dto.content = scraped.description || scraped.body || '';

  dto.price = scraped.price != null ? Number(scraped.price) : null;
  dto.area = scraped.surface != null ? String(scraped.surface) : null;
  dto.surface = scraped.surface != null ? String(scraped.surface) : null;
  dto.rooms = scraped.rooms != null ? String(scraped.rooms) : null;
  dto.bedrooms = scraped.bedrooms != null ? String(scraped.bedrooms) : null;
  dto.bathrooms = scraped.bathrooms != null ? String(scraped.bathrooms) : null;
  dto.floor = scraped.floor != null ? String(scraped.floor) : null;
  dto.landSurface = scraped.landSurface != null ? Number(scraped.landSurface) : null;
  dto.propertyCharges = scraped.charges != null ? Number(scraped.charges) : null;
  dto.propertyAgencyFees = scraped.agencyFees != null ? Number(scraped.agencyFees) : null;
  dto.buildingYear = scraped.yearBuilt != null ? String(scraped.yearBuilt) : null;

  dto.address = scraped.address || null;
  dto.zipcode = scraped.zipcode || null;
  dto.city = scraped.city || null;
  dto.country = scraped.country || 'France';

  dto.propertyTypeRaw = inferTransactionType(scraped);
  dto.propertyKind = inferPropertyKind(scraped);

  dto.username = scraped.ownerName || null;
  dto.phoneNumber = scraped.ownerPhone || null;
  dto.importBy = 'platform';
  dto.externalUrl = scraped.url || null;

  dto.energy_efficient = scraped.energyRate ? mapEnergyClass(scraped.energyRate) : null;
  dto.emission_efficient = scraped.gesRate ? mapEnergyClass(scraped.gesRate) : null;

  const images = Array.isArray(scraped.images) ? scraped.images : [];
  dto.images = images.slice(0, 50);

  let coords = null;
  if (Array.isArray(scraped.coordinates) && scraped.coordinates.length >= 2) {
    const lat = Number(scraped.coordinates[0]);
    const lon = Number(scraped.coordinates[1]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      dto.position = { type: 'Point', coordinates: [lon, lat] };
      coords = [lat, lon];
    }
  }

  dto.external = scraped;
  dto.timestamps = {};

  return dto;
}

function inferTransactionType(scraped) {
  const url = (scraped.url || '').toLowerCase();
  const title = (scraped.title || '').toLowerCase();
  const desc = (scraped.description || '').toLowerCase();

  if (/location|rent|louer|locatif/.test(url + ' ' + title + ' ' + desc)) return 'rent';
  if (/vente|achat|a vendre|buy|sale/.test(url + ' ' + title + ' ' + desc)) return 'sale';
  return 'sale';
}

function inferPropertyKind(scraped) {
  const title = (scraped.title || '').toLowerCase();
  const desc = (scraped.description || '').toLowerCase();
  const criteria = scraped.criteria || {};
  const typeLabel = ((criteria.type || criteria['Type de bien'] || criteria['Property type'] || '') + ' ' + title + ' ' + desc).toLowerCase();

  if (/maison|villa|house/.test(typeLabel)) return 'house';
  if (/chateau|castle/.test(typeLabel)) return 'castle';
  if (/ferme|farm/.test(typeLabel)) return 'farm';
  if (/immeuble|building/.test(typeLabel)) return 'building';
  return 'apartment';
}

function mapEnergyClass(value) {
  if (!value) return null;
  const v = String(value).toUpperCase().trim();
  if (/^[A-E]$/.test(v)) return v;
  const map = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' };
  return map[v] || null;
}

module.exports = { normalizeScrapedData };
