const scraper = require('../modules/web-scraper/leboncoin');
const { upsertFromScrapedData } = require('../modules/web-scraper/sync');
const { handleServerError } = require('../utls/helper');

async function scrapeAndImport(req, res) {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'URL requise' },
      });
    }

    const userId = req.identity ? req.identity._id : null;
    const scraped = await scraper.scrape(url);
    const result = await upsertFromScrapedData(scraped, userId);

    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        property: result.property,
        externalListing: result.externalListing,
        created: result.created,
        source: scraped.source,
      },
      message: result.created
        ? 'Bien créé avec succès depuis l\'annonce'
        : 'Bien mis à jour depuis l\'annonce',
    });
  } catch (err) {
    console.error('[ScrapeController] Error:', err);
    return handleServerError(res, err, 'scrapeAndImport');
  }
}

async function manualImport(req, res) {
  try {
    const { url, title, description, price, city, zipcode, surface, rooms, bedrooms, bathrooms, floor, landSurface, yearBuilt, charges, agencyFees, energyRate, gesRate, images, coordinates, ownerName, ownerPhone } = req.body;

    if (!title && !url) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'Un titre ou une URL source est requis' },
      });
    }

    const userId = req.identity ? req.identity._id : null;
    const source = url ? new URL(url).hostname : 'manual';

    const scraped = {
      url: url || null,
      source,
      sourceId: url ? null : `manual_${Date.now()}`,
      title: title || '',
      description: description || '',
      price: price != null ? Number(price) : null,
      city: city || null,
      zipcode: zipcode || null,
      surface: surface != null ? Number(surface) : null,
      rooms: rooms != null ? Number(rooms) : null,
      bedrooms: bedrooms != null ? Number(bedrooms) : null,
      bathrooms: bathrooms != null ? Number(bathrooms) : null,
      floor: floor != null ? Number(floor) : null,
      landSurface: landSurface != null ? Number(landSurface) : null,
      yearBuilt: yearBuilt != null ? Number(yearBuilt) : null,
      charges: charges != null ? Number(charges) : null,
      agencyFees: agencyFees != null ? Number(agencyFees) : null,
      energyRate: energyRate || null,
      gesRate: gesRate || null,
      images: Array.isArray(images) ? images : [],
      coordinates: Array.isArray(coordinates) ? coordinates : null,
      ownerName: ownerName || null,
      ownerPhone: ownerPhone || null,
      criteria: {},
    };

    const result = await upsertFromScrapedData(scraped, userId);

    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: {
        property: result.property,
        externalListing: result.externalListing,
        created: result.created,
        source,
      },
      message: result.created
        ? 'Bien créé avec succès'
        : 'Bien mis à jour',
    });
  } catch (err) {
    return handleServerError(res, err, 'manualImport');
  }
}

async function preview(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'URL requise' },
      });
    }

    const scraped = await scraper.scrape(url);

    return res.json({
      success: true,
      data: {
        title: scraped.title,
        description: scraped.description,
        price: scraped.price,
        city: scraped.city,
        zipcode: scraped.zipcode,
        surface: scraped.surface,
        rooms: scraped.rooms,
        bedrooms: scraped.bedrooms,
        bathrooms: scraped.bathrooms,
        floor: scraped.floor,
        landSurface: scraped.landSurface,
        yearBuilt: scraped.yearBuilt,
        charges: scraped.charges,
        agencyFees: scraped.agencyFees,
        energyRate: scraped.energyRate,
        gesRate: scraped.gesRate,
        images: scraped.images,
        coordinates: scraped.coordinates,
        ownerName: scraped.ownerName,
      },
    });
  } catch (err) {
    return handleServerError(res, err, 'scrapePreview');
  }
}

module.exports = { scrapeAndImport, manualImport, preview };
