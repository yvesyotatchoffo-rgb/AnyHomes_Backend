const db = require('../../models');
const { normalizeScrapedData } = require('./normalizer');

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

function buildPropertyPayload(dto, userId) {
  const propertyType = inferPropertyType(dto.propertyTypeRaw);
  const propertyKind = inferPropertyKind(dto.propertyKind || dto.propertyTitle);

  return {
    name: dto.propertyTitle || 'Importé depuis une annonce web',
    propertyTitle: dto.propertyTitle || 'Importé depuis une annonce web',
    content: dto.content || '',
    price: dto.price != null ? Number(dto.price) : null,
    area: dto.surface != null ? String(dto.surface) : undefined,
    surface: dto.surface != null ? String(dto.surface) : undefined,
    rooms: dto.rooms != null ? String(dto.rooms) : undefined,
    bedrooms: dto.bedrooms != null ? String(dto.bedrooms) : undefined,
    bathroom: dto.bathrooms != null ? String(dto.bathrooms) : undefined,
    propertyFloor: dto.floor != null ? String(dto.floor) : undefined,
    landSurface: dto.landSurface != null ? Number(dto.landSurface) : undefined,
    address: dto.address || undefined,
    zipcode: dto.zipcode || undefined,
    city: dto.city || undefined,
    country: dto.country || 'France',
    newlocation: dto.position || { type: 'Point', coordinates: [0, 0] },
    propertyCharges: dto.propertyCharges != null ? Number(dto.propertyCharges) : undefined,
    propertyAgencyFees: dto.propertyAgencyFees != null ? Number(dto.propertyAgencyFees) : undefined,
    building: dto.buildingYear || undefined,
    images: [],
    propertyType,
    type: propertyKind,
    status: 'active',
    addedBy: userId,
    importBy: 'platform',
    externalUrl: dto.externalUrl || dto.url || undefined,
    energy_efficient: dto.energy_efficient || undefined,
    emission_efficient: dto.emission_efficient || undefined,
    username: dto.username || undefined,
    phoneNumber: dto.phoneNumber || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function upsertFromScrapedData(scraped, userId) {
  const dto = await normalizeScrapedData(scraped);

  const source = dto.source;
  const sourceId = dto.sourceId;
  if (!sourceId) {
    throw new Error('Impossible de déterminer un identifiant unique pour cette annonce');
  }

  let existing = await db.externalListing.findOne({ source, sourceId });

  if (existing && existing.propertyId) {
    const prop = await db.property.findById(existing.propertyId);
    if (prop) {
      const updates = {};
      if (dto.price != null && dto.price !== prop.price) updates.price = dto.price;
      if (dto.propertyTitle && dto.propertyTitle !== prop.propertyTitle) updates.propertyTitle = dto.propertyTitle;
      if (dto.surface && String(dto.surface) !== String(prop.surface)) updates.surface = String(dto.surface);
      if (dto.rooms != null && String(dto.rooms) !== String(prop.rooms)) updates.rooms = String(dto.rooms);
      if (dto.bedrooms != null && String(dto.bedrooms) !== String(prop.bedrooms)) updates.bedrooms = String(dto.bedrooms);
      if (dto.city && dto.city !== prop.city) updates.city = dto.city;
      if (dto.zipcode && dto.zipcode !== prop.zipcode) updates.zipcode = dto.zipcode;
      if (dto.address && dto.address !== prop.address) updates.address = dto.address;
      if (dto.content && dto.content !== prop.content) updates.content = dto.content;
      if (dto.position) updates.newlocation = dto.position;

      if (Object.keys(updates).length) {
        updates.updatedAt = new Date();
        await db.property.updateOne({ _id: prop._id }, { $set: updates });
      }

      existing.raw = dto.external;
      existing.lastSyncAt = new Date();
      await existing.save();

      return { property: prop, created: false, externalListing: existing };
    }
  }

  let sysUser = userId;
  if (!sysUser) {
    const user = await db.users.findOne({ email: 'system_anyhomes_importer@anyhomes.local' });
    sysUser = user ? user._id : null;
  }

  const propData = buildPropertyPayload(dto, sysUser);
  const property = await db.property.create(propData);

  const imageUrls = (dto.images || []).slice(0, 10);
  if (imageUrls.length) {
    const placeholders = imageUrls.map(u => ({ originalname: u, status: 'queued' }));
    property.images = (property.images || []).concat(placeholders);
    await property.save();

    for (let imgUrl of imageUrls) {
      try {
        await db.mediaJob.create({ propertyId: property._id, externalListingId: null, originalUrl: imgUrl });
      } catch (err) {
        console.warn('Erreur création mediaJob', imgUrl, err && err.message);
      }
    }
  }

  const external = await db.externalListing.create({
    source,
    sourceId,
    raw: dto.external,
    propertyId: property._id,
    status: 'active',
    lastSyncAt: new Date(),
  });

  return { property, created: true, externalListing: external };
}

module.exports = { upsertFromScrapedData };
