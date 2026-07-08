const puppeteer = require('puppeteer');

const DOMAIN = 'leboncoin.fr';

function matches(url) {
  try {
    const host = new URL(url).hostname;
    return host === DOMAIN || host === 'www.' + DOMAIN || host === 'leboncoin.com';
  } catch { return false; }
}

function extractAdId(url) {
  try {
    const parts = new URL(url).pathname.split('/');
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) return last;
  } catch {}
  return null;
}

async function scrapeWithPuppeteer(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
      'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="128", "Google Chrome";v="128"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en'] });
    });

    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const status = response.status();
    if (status === 403) {
      console.warn('[leboncoin] Blocked by anti-bot (403). Trying API fallback...');
      return null;
    }

    await new Promise(r => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
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

      const nextData = document.getElementById('__NEXT_DATA__');
      if (nextData) {
        try {
          const parsed = JSON.parse(nextData.textContent);
          const ad = parsed?.props?.pageProps?.ad || parsed?.props?.pageProps?.listingData || {};
          const attrs = ad.attributes || {};

          result.title = ad.subject || ad.title || '';
          result.description = ad.body || '';
          result.price = attrs.price != null ? Number(attrs.price) : null;
          result.city = ad.location?.city || attrs.city || '';
          result.zipcode = ad.location?.zipcode || attrs.zipcode || '';
          result.surface = attrs.square != null ? Number(attrs.square) : null;
          result.rooms = attrs.rooms != null ? Number(attrs.rooms) : null;
          result.bedrooms = attrs.bedrooms != null ? Number(attrs.bedrooms) : null;
          result.bathrooms = attrs.bathrooms != null ? Number(attrs.bathrooms) : null;
          result.floor = attrs.floor != null ? Number(attrs.floor) : null;
          result.yearBuilt = attrs.year_built != null ? Number(attrs.year_built) : null;
          result.charges = attrs.charges != null ? Number(attrs.charges) : null;
          result.agencyFees = attrs.agency_fees != null ? Number(attrs.agency_fees) : null;
          result.energyRate = attrs.energy_rate || '';
          result.gesRate = attrs.ges_rate || '';
          result.ownerName = ad.owner?.name || ad.user?.name || '';
          result.ownerPhone = ad.owner?.phone || ad.user?.phone || '';
          result.criteria = attrs;

          if (ad.location?.lat) {
            result.coordinates = [Number(ad.location.lat), Number(ad.location.lng)];
          }

          if (Array.isArray(ad.images)) {
            result.images = ad.images
              .map(i => i.url || (i.urls && i.urls.medium) || (typeof i === 'string' ? i : null))
              .filter(Boolean);
          }
        } catch {}
      }

      if (!result.title) {
        const h1 = document.querySelector('h1[data-qa-id="adview_title"], h1');
        if (h1) result.title = h1.textContent.trim();

        const priceEl = document.querySelector('[data-qa-id="price"]') ||
                        document.querySelector('[class*="price"]');
        if (priceEl) {
          const text = priceEl.textContent.trim();
          const nums = text.replace(/[^0-9]/g, '');
          if (nums) result.price = Number(nums);
        }

        document.querySelectorAll('[class*="property"] li, [data-qa-id="criteria"] li').forEach(li => {
          const text = li.textContent.trim();
          const parts = text.split(':');
          if (parts.length === 2) {
            const key = parts[0].trim();
            const val = parts[1].trim();
            result.criteria[key] = val;
            if (/surfac/i.test(key) || /m²/i.test(val)) result.surface = Number(val.replace(/[^0-9]/g, ''));
            if (/pi[eè]ce/i.test(key)) result.rooms = Number(val.replace(/[^0-9]/g, ''));
            if (/chambre/i.test(key)) result.bedrooms = Number(val.replace(/[^0-9]/g, ''));
            if (/code postal/i.test(key)) result.zipcode = val;
            if (/ville/i.test(key)) result.city = val;
          }
        });

        const gallery = document.querySelector('[class*="gallery"] img, [class*="carousel"] img');
        if (gallery) {
          const src = gallery.getAttribute('src') || gallery.getAttribute('data-src');
          if (src) result.images.push(src);
        }
      }

      return result;
    });

    return data;
  } finally {
    await browser.close();
  }
}

async function scrape(url) {
  const adId = extractAdId(url);
  if (!adId) {
    throw new Error('Impossible d\'extraire l\'ID de l\'annonce Leboncoin');
  }

  const data = await scrapeWithPuppeteer(url);

  if (data) {
    return {
      url,
      source: 'leboncoin',
      sourceId: adId,
      ...data,
    };
  }

  throw new Error(
    'Leboncoin bloque le scraping automatisé. Utilisez l\'import manuel via POST /scrape/manual.'
  );
}

module.exports = { scrape, matches };
