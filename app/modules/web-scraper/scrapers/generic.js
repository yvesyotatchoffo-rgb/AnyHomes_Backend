const axios = require('axios');
const cheerio = require('cheerio');

function matches(url) {
  return true;
}

async function scrape(url) {
  const { data: html } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(html);
  const result = {
    title: '',
    description: '',
    price: null,
    city: '',
    zipcode: '',
    surface: null,
    rooms: null,
    bedrooms: null,
    bathrooms: null,
    floor: null,
    yearBuilt: null,
    charges: null,
    agencyFees: null,
    energyRate: null,
    gesRate: null,
    images: [],
    coordinates: null,
    ownerName: '',
    ownerPhone: '',
    criteria: {},
  };

  const jsonLd = $('script[type="application/ld+json"]');
  jsonLd.each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      extractJsonLd(parsed, result);
    } catch {}
  });

  result.title = result.title ||
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    '';

  result.description = result.description ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  if (!result.price) {
    const priceMeta = $('meta[property="product:price:amount"]').attr('content') ||
                      $('meta[property="og:price:amount"]').attr('content');
    if (priceMeta) result.price = parseFloat(priceMeta);
  }

  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) result.images.push(ogImage);

  const cityMeta = $('meta[property="og:locality"]').attr('content') ||
                   $('meta[name="city"]').attr('content') ||
                   $('[itemprop="addressLocality"]').attr('content');
  if (cityMeta) result.city = cityMeta;

  const zipMeta = $('meta[property="og:postal-code"]').attr('content') ||
                  $('[itemprop="postalCode"]').attr('content');
  if (zipMeta) result.zipcode = zipMeta;

  return {
    url,
    source: new URL(url).hostname,
    sourceId: null,
    ...result,
  };
}

function extractJsonLd(node, result) {
  if (!node || typeof node !== 'object') return;

  if (node['@type'] === 'Product' || node['@type'] === 'RealEstateListing') {
    if (node.name) result.title = result.title || node.name;
    if (node.description) result.description = result.description || node.description;
    if (node.offers) {
      const price = node.offers.price || (node.offers && node.offers.priceSpecification && node.offers.priceSpecification.price);
      if (price != null) result.price = result.price || parseFloat(price);
    }
    if (node.image) {
      const imgs = Array.isArray(node.image) ? node.image : [node.image];
      imgs.forEach(i => { if (i && !result.images.includes(i)) result.images.push(i); });
    }
  }

  if (node['@type'] === 'Place' || node['@type'] === 'LocalBusiness') {
    if (node.address) {
      if (node.address.addressLocality) result.city = result.city || node.address.addressLocality;
      if (node.address.postalCode) result.zipcode = result.zipcode || node.address.postalCode;
    }
    if (node.geo) {
      if (node.geo.latitude && node.geo.longitude) {
        result.coordinates = [parseFloat(node.geo.latitude), parseFloat(node.geo.longitude)];
      }
    }
  }

  if (Array.isArray(node['@graph'])) {
    node['@graph'].forEach(n => extractJsonLd(n, result));
  }
}

module.exports = { scrape, matches };
