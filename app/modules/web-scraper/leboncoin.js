const leboncoinScraper = require('./scrapers/leboncoin');
const genericScraper = require('./scrapers/generic');

const SCRAPERS = [leboncoinScraper, genericScraper];

function detectScraper(url) {
  for (const scraper of SCRAPERS) {
    if (scraper.matches(url)) return scraper;
  }
  return genericScraper;
}

async function scrape(url) {
  const scraper = detectScraper(url);
  return scraper.scrape(url);
}

function isSupported(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

module.exports = { scrape, isSupported };
