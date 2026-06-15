const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const qrcode = require('qrcode');
const puppeteer = require('puppeteer');
const db = require('../models');

const FRONT_WEB_URL = process.env.FRONT_WEB_URL || 'http://localhost:8089';
const BACK_WEB_URL = process.env.BACK_WEB_URL || `http://localhost:${process.env.PORT || 6089}`;
const QR_FLYERS_DIR = path.join(__dirname, '../../public/qr-flyers');

const ALLOWED_METRICS = ['likes', 'followers', 'messages', 'interestsReceived', 'views', 'shares'];

function ensureQrFlyerDir() {
  if (!fs.existsSync(QR_FLYERS_DIR)) {
    fs.mkdirSync(QR_FLYERS_DIR, { recursive: true });
  }
}

function getPhotoUrl(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    return photo;
  }
  if (photo.url) {
    return photo.url;
  }
  if (photo.file) {
    return `${BACK_WEB_URL}/img/${photo.file}`;
  }
  if (photo.fileName) {
    return `${BACK_WEB_URL}/img/${photo.fileName}`;
  }
  if (photo.originalname) {
    return `${BACK_WEB_URL}/img/${photo.originalname}`;
  }
  if (photo.path) {
    return `${BACK_WEB_URL}/${photo.path}`;
  }
  return null;
}

function getPhotoIdentifier(photo, index) {
  if (!photo) return String(index);
  if (photo.file) return photo.file;
  if (photo.fileName) return photo.fileName;
  if (photo.originalname) return photo.originalname;
  if (photo.id) return String(photo.id);
  if (photo._id) return String(photo._id);
  if (photo.name) return photo.name;
  if (photo.url) return photo.url;
  return String(index);
}

function buildPropertySummary(property) {
  const parts = [];
  if (property.rooms) parts.push(`${property.rooms} pièces`);
  if (property.surface) parts.push(`${property.surface} m²`);
  if (property.city) parts.push(property.city);
  if (property.zipcode) parts.push(property.zipcode);
  return parts.filter(Boolean).join(' • ');
}

function getPublicPropertyUrl(propertyId) {
  return `${FRONT_WEB_URL}/property-details?id=${propertyId}`;
}

function normalizePhoto(photo, index) {
  const url = getPhotoUrl(photo);
  return {
    id: photo && photo.fileName ? photo.fileName : String(index),
    url,
    isCover: index === 0,
    originalName: photo && photo.originalname ? photo.originalname : null,
  };
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

const mockGuestProperties = [
  {
    propertyId: 'guest-prop-1',
    title: 'Maison familiale',
    summary: '5 pièces • 100 m² • Paris',
    coverUrl: '/assets/img/dashboard/attractivity/attractivity-1.jpg',
    publicUrl: `${FRONT_WEB_URL}/property-details?id=guest-prop-1`,
    availablePhotos: [
      { id: 'guest-photo-1', url: '/assets/img/dashboard/attractivity/attractivity-1.jpg', isCover: true },
    ],
    latestFlyer: null,
  },
  {
    propertyId: 'guest-prop-2',
    title: 'Appartement lumineux',
    summary: '3 pièces • 64 m² • Lyon',
    coverUrl: '/assets/img/dashboard/attractivity/attractivity-2.jpg',
    publicUrl: `${FRONT_WEB_URL}/property-details?id=guest-prop-2`,
    availablePhotos: [
      { id: 'guest-photo-2', url: '/assets/img/dashboard/attractivity/attractivity-2.jpg', isCover: true },
    ],
    latestFlyer: null,
  },
];

function findMockGuestProperty(propertyId) {
  return mockGuestProperties.find((property) => property.propertyId === propertyId) || null;
}

async function buildMetricsSnapshot(property) {
  const likes = Array.isArray(property.like) ? property.like.length : 0;
  const followers = Array.isArray(property.follow) ? property.follow.length : 0;
  const views = Number(property.propertyViewerCount || 0);
  const shares = Number(property.shareCount || 0);
  const messages = await db.messages.countDocuments({ property_id: property._id, isDeleted: false });
  const interestsReceived = await db.interests.countDocuments({ propertyId: property._id, isDeleted: false });
  return {
    likes,
    followers,
    views,
    shares,
    messages,
    interestsReceived,
  };
}

async function renderFlyerHtml({ title, summary, selectedPhotoUrl, qrCodeDataUrl, metrics, publicUrl }) {
  const metricItems = metrics
    .map(
      (metric) => `
      <div style="flex:1; min-width:120px; padding:10px; border:1px solid #e6e6e6; border-radius:12px; margin:6px; background:#ffffff;">
        <div style="font-size:12px; color:#666; text-transform: uppercase; letter-spacing:0.05em;">${metric.label}</div>
        <div style="font-size:24px; font-weight:700; color:#111; margin-top:6px;">${metric.value}</div>
      </div>`
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>QR Flyer</title>
      <style>
        body { margin:0; font-family: Arial, sans-serif; background:#f2f3f7; }
        .page { width: 1200px; min-height: 1700px; background: #ffffff; padding: 48px; box-sizing: border-box; }
        .brand { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .brand__title { font-size: 36px; font-weight: 800; color: #222; }
        .brand__tag { font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 0.16em; }
        .hero { display: flex; gap: 24px; margin-bottom: 32px; }
        .hero__image { width: 62%; border-radius: 24px; overflow: hidden; background:#eee; }
        .hero__image img { width:100%; height:100%; object-fit: cover; }
        .hero__sidebar { width: 38%; display: flex; flex-direction: column; justify-content: space-between; }
        .card { background:#f8f9fb; border-radius: 24px; padding: 24px; box-sizing: border-box; }
        .headline { font-size: 32px; font-weight: 800; line-height: 1.05; color: #222; margin-bottom: 16px; }
        .body-text { font-size: 18px; line-height: 1.5; color: #444; margin-bottom: 24px; }
        .cta { font-size: 16px; color: #fff; background: #5a3bfb; border-radius: 999px; padding: 16px 24px; display: inline-block; text-decoration: none; }
        .qr-section { display: flex; align-items: center; gap: 20px; margin-top: 16px; }
        .qr-box { width: 260px; height: 260px; background: #fff; border:1px solid #e6e6e6; border-radius: 24px; display:flex; align-items:center; justify-content:center; }
        .qr-box img { max-width: 220px; max-height: 220px; }
        .qr-copy { font-size: 14px; color: #666; line-height:1.6; }
        .metrics { display: flex; flex-wrap: wrap; margin-top: 24px; }
        .footer { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px solid #eee; }
        .footer-left { max-width: 70%; }
        .footer-left h2 { font-size: 18px; margin: 0 0 10px; color: #111; }
        .footer-left p { margin: 0; color: #666; line-height:1.5; }
        .footer-right { text-align: right; }
        .brand-pill { display: inline-block; background:#5a3bfb; color:#fff; padding:10px 18px; border-radius:999px; font-weight:700; font-size:14px; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="brand">
          <div>
            <div class="brand__title">AnyHomes QR Flyer</div>
            <div class="brand__tag">100% Gratuit • AnyHomes.fr</div>
          </div>
          <div class="brand-pill">V1</div>
        </div>
        <div class="hero">
          <div class="hero__image">
            <img src="${selectedPhotoUrl || ''}" alt="Property photo" />
          </div>
          <div class="hero__sidebar">
            <div class="card">
              <div class="headline">Scannez le QR Code pour découvrir ce bien</div>
              <div class="body-text">${title}</div>
              <div class="body-text">${summary}</div>
              <a class="cta" href="${publicUrl}">Voir l'annonce</a>
              <div class="qr-section">
                <div class="qr-box"><img src="${qrCodeDataUrl}" alt="QR Code" /></div>
                <div>
                  <div class="body-text"><strong>Scannez-moi</strong></div>
                  <div class="qr-copy">Ce QR Code envoie directement vers la page publique du bien.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="metrics">
          ${metricItems}
        </div>
        <div class="footer">
          <div class="footer-left">
            <h2>AnyHomes</h2>
            <p>Promotion de votre bien sans agence, 100% gratuit.</p>
          </div>
          <div class="footer-right">
            <p>URL publique :</p>
            <p><strong>${publicUrl}</strong></p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

async function launchBrowser() {
  return puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

async function takeScreenshot(html, outputPath, format) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.setViewport({ width: 1200, height: 1700, deviceScaleFactor: 2 });
  if (format === 'pdf') {
    await page.pdf({ path: outputPath, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  } else {
    await page.screenshot({ path: outputPath, type: format, fullPage: true });
  }
  await browser.close();
}

exports.listOwnerProperties = async (req, res) => {
  try {
    const userId = req.query.userId || (req.identity && req.identity._id);
    const { search, page = 1, limit = 30 } = req.query;
    const query = {
      addedBy: userId,
      isDeleted: false,
    };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { propertyTitle: { $regex: searchRegex } },
        { address: { $regex: searchRegex } },
        { city: { $regex: searchRegex } },
        { zipcode: { $regex: searchRegex } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const properties = await db.property
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const propertyIds = properties.map((p) => p._id);
    const flyers = await db.qrFlyers
      .find({ propertyId: { $in: propertyIds }, ownerId: userId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    const latestFlyerByProperty = new Map();
    flyers.forEach((flyer) => {
      const propertyKey = flyer.propertyId.toString();
      if (!latestFlyerByProperty.has(propertyKey)) {
        latestFlyerByProperty.set(propertyKey, flyer);
      }
    });

    const items = properties.map((property) => {
      const firstImage = Array.isArray(property.images) && property.images.length > 0 ? property.images[0] : null;
      const coverUrl = getPhotoUrl(firstImage) || null;
      const latestFlyer = latestFlyerByProperty.get(property._id.toString()) || null;

      return {
        propertyId: property._id,
        title: property.propertyTitle || property.name || 'Sans titre',
        summary: buildPropertySummary(property),
        coverUrl,
        publicUrl: getPublicPropertyUrl(property._id),
        availablePhotos: Array.isArray(property.images)
          ? property.images.map((photo, index) => normalizePhoto(photo, index))
          : [],
        latestFlyer: latestFlyer
          ? {
              id: latestFlyer._id,
              previewImageUrl: latestFlyer.previewImageUrl,
              scansCount: latestFlyer.scansCount,
              lastScanAt: latestFlyer.lastScanAt,
              createdAt: latestFlyer.createdAt,
            }
          : null,
      };
    });

    const total = await db.property.countDocuments(query);
    if (items.length === 0 && (req.isGuest || userId === 'guest-user-000')) {
      return res.json({ success: true, data: mockGuestProperties, pagination: { page: 1, limit: mockGuestProperties.length, total: mockGuestProperties.length } });
    }
    return res.json({ success: true, data: items, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

async function findLatestFlyerByProperty(propertyId, ownerId) {
  return db.qrFlyers
    .findOne({ propertyId, ownerId, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();
}

exports.listFlyers = async (req, res) => {
  try {
    const userId = req.query.userId || (req.identity && req.identity._id);
    const { propertyId, page = 1, limit = 30 } = req.query;
    const query = { ownerId: userId, isDeleted: false };

    if (propertyId) {
      query.propertyId = propertyId;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const flyers = await db.qrFlyers
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await db.qrFlyers.countDocuments(query);
    return res.json({
      success: true,
      data: flyers.map((flyer) => ({
        id: flyer._id,
        propertyId: flyer.propertyId,
        selectedPhoto: flyer.selectedPhoto,
        selectedMetrics: flyer.selectedMetrics,
        displayedMetricsSnapshot: flyer.displayedMetricsSnapshot,
        previewImageUrl: flyer.previewImageUrl,
        pdfUrl: flyer.pdfUrl,
        pngUrl: flyer.pngUrl,
        jpgUrl: flyer.jpgUrl,
        scansCount: flyer.scansCount,
        lastScanAt: flyer.lastScanAt,
        createdAt: flyer.createdAt,
      })),
      pagination: { page: Number(page), limit: Number(limit), total },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.debugCreateFlyer = async (req, res) => {
  try {
    return res.json({
      success: true,
      message: 'Debug route reached',
      body: req.body,
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        'content-type': req.headers['content-type'],
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.debugPing = async (req, res) => {
  try {
    return res.json({
      success: true,
      message: 'QR Code debug ping OK',
      url: req.originalUrl,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.getPropertyFlyer = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    const propertyId = req.params.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'propertyId manquant' });
    }

    const flyer = await findLatestFlyerByProperty(propertyId, userId);
    if (!flyer) {
      return res.status(404).json({ success: false, message: 'Aucun QR Code existant pour ce bien' });
    }

    return res.json({
      success: true,
      data: {
        id: flyer._id,
        propertyId: flyer.propertyId,
        selectedPhoto: flyer.selectedPhoto,
        selectedMetrics: flyer.selectedMetrics,
        displayedMetricsSnapshot: flyer.displayedMetricsSnapshot,
        previewImageUrl: flyer.previewImageUrl,
        pdfUrl: flyer.pdfUrl,
        pngUrl: flyer.pngUrl,
        jpgUrl: flyer.jpgUrl,
        scansCount: flyer.scansCount,
        lastScanAt: flyer.lastScanAt,
        createdAt: flyer.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.deletePropertyFlyer = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    const propertyId = req.params.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'propertyId manquant' });
    }

    const flyer = await db.qrFlyers
      .findOne({ propertyId, ownerId: userId, isDeleted: false })
      .sort({ createdAt: -1 });
    if (!flyer) {
      return res.status(404).json({ success: false, message: 'Aucun QR Code à supprimer pour ce bien' });
    }

    flyer.isDeleted = true;
    await flyer.save();
    return res.json({ success: true, message: 'QR Code supprimé' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.getPropertySetup = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    const propertyId = req.params.propertyId;
    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'propertyId manquant' });
    }

    let property = await db.property.findOne({ _id: propertyId, addedBy: userId, isDeleted: false }).lean();
    const guestProperty = !property && (req.isGuest || userId === 'guest-user-000') ? findMockGuestProperty(propertyId) : null;
    if (!property && !guestProperty) {
      return res.status(404).json({ success: false, message: 'Propriété introuvable' });
    }

    if (guestProperty) {
      const availableMetrics = [
        { key: 'likes', label: 'Likes', value: 0 },
        { key: 'views', label: 'Vues', value: 0 },
        { key: 'shares', label: 'Partages', value: 0 },
        { key: 'followers', label: 'Followers', value: 0 },
        { key: 'interestsReceived', label: 'Sollicitations', value: 0 },
        { key: 'messages', label: 'Messages', value: 0 },
      ];

      return res.json({
        success: true,
        data: {
          property: {
            id: guestProperty.propertyId,
            title: guestProperty.title,
            summary: guestProperty.summary,
            publicUrl: guestProperty.publicUrl,
          },
          photos: guestProperty.availablePhotos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            isCover: photo.isCover || false,
            originalName: photo.originalName || null,
          })),
          availableMetrics,
          template: {
            version: 'v1',
            marketingHeadline: 'Scannez ce QR Code pour obtenir plus de détails sur ce bien',
            marketingBody: 'Promotion de votre bien en quelques clics.',
            brandFooter: '100% Gratuit AnyHomes.fr',
          },
        },
      });
    }

    const metricsSnapshot = await buildMetricsSnapshot(property);

    const availableMetrics = [
      { key: 'likes', label: 'Likes', value: metricsSnapshot.likes },
      { key: 'views', label: 'Vues', value: metricsSnapshot.views },
      { key: 'shares', label: 'Partages', value: metricsSnapshot.shares },
      { key: 'followers', label: 'Followers', value: metricsSnapshot.followers },
      { key: 'interestsReceived', label: 'Sollicitations', value: metricsSnapshot.interestsReceived },
      { key: 'messages', label: 'Messages', value: metricsSnapshot.messages },
    ];

    return res.json({
      success: true,
      data: {
        property: {
          id: property._id,
          title: property.propertyTitle || property.name || 'Sans titre',
          summary: buildPropertySummary(property),
          publicUrl: getPublicPropertyUrl(property._id),
        },
        photos: Array.isArray(property.images)
          ? property.images.map((photo, index) => normalizePhoto(photo, index))
          : [],
        availableMetrics,
        template: {
          version: 'v1',
          marketingHeadline: 'Scannez ce QR Code pour obtenir plus de détails sur mon bien',
          marketingBody: 'Acheter ou vendre un bien immobilier sans agence n’a jamais été aussi simple',
          brandFooter: '100% Gratuit AnyHomes.fr',
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.createFlyer = async (req, res) => {
  try {
    console.log('QR createFlyer received', {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        'content-type': req.headers['content-type'],
      },
    });
    const userId = req.identity && req.identity._id;
    const propertyId = req.body.propertyId || req.body.id;
    const selectedPhotoId = req.body.selectedPhotoId || req.body.selectedImageId || req.body.photoId || req.body.imageId;
    const rawSelectedMetrics = req.body.selectedMetrics;
    const selectedMetrics = Array.isArray(rawSelectedMetrics)
      ? rawSelectedMetrics
      : typeof rawSelectedMetrics === 'string'
      ? rawSelectedMetrics
          .trim()
          .split(/[;,]+/)
          .map((metric) => metric.trim())
          .filter(Boolean)
      : [];

    if (!propertyId || !selectedPhotoId) {
      return res.status(400).json({ success: false, message: 'payload invalide' });
    }

    const invalidMetrics = selectedMetrics.filter((metric) => !ALLOWED_METRICS.includes(metric));
    if (invalidMetrics.length > 0) {
      return res.status(400).json({ success: false, message: 'selectedMetrics contient une valeur non autorisée' });
    }

    let property = await db.property.findOne({ _id: propertyId, addedBy: userId, isDeleted: false }).lean();
    const guestProperty = !property && (req.isGuest || userId === 'guest-user-000') ? findMockGuestProperty(propertyId) : null;
    if (!property && !guestProperty) {
      return res.status(404).json({ success: false, message: 'Propriété introuvable ou non autorisée' });
    }

    const photos = Array.isArray(property?.images) ? property.images : guestProperty?.availablePhotos || [];
    let selectedPhoto = null;
    let selectedPhotoIndex = 0;
    const availablePhotoIds = photos.map((photo, index) => getPhotoIdentifier(photo, index));
    photos.forEach((photo, index) => {
      const photoId = getPhotoIdentifier(photo, index);
      if (photoId === selectedPhotoId) {
        selectedPhoto = photo;
        selectedPhotoIndex = index;
      }
    });

    if (!selectedPhoto) {
      return res.status(400).json({
        success: false,
        message: 'Photo sélectionnée invalide',
        details: { selectedPhotoId, availablePhotoIds },
      });
    }

    const metricsSnapshot = property
      ? await buildMetricsSnapshot(property)
      : { likes: 0, followers: 0, views: 0, shares: 0, messages: 0, interestsReceived: 0 };
    const selectedMetricsSnapshot = {};
    selectedMetrics.forEach((metric) => {
      selectedMetricsSnapshot[metric] = metricsSnapshot[metric] ?? 0;
    });

    ensureQrFlyerDir();
    const token = generateToken();
    const trackUrl = `${BACK_WEB_URL}/qr/${token}`;
    const qrCodeDataUrl = await qrcode.toDataURL(trackUrl, { errorCorrectionLevel: 'H', margin: 1, width: 360 });
    const publicUrl = getPublicPropertyUrl(property?._id || guestProperty.propertyId);
    const selectedPhotoUrl = getPhotoUrl(selectedPhoto);

    const metricMap = {
      likes: 'Likes',
      views: 'Vues',
      shares: 'Partages',
      followers: 'Followers',
      interestsReceived: 'Sollicitations',
      messages: 'Messages',
    };

    const html = await renderFlyerHtml({
      title: property?.propertyTitle || property?.name || guestProperty.title || 'Sans titre',
      summary: property ? buildPropertySummary(property) : guestProperty.summary,
      selectedPhotoUrl,
      qrCodeDataUrl,
      metrics: selectedMetrics.map((key) => ({
        key,
        label: metricMap[key] || key,
        value: selectedMetricsSnapshot[key] ?? 0,
      })),
      publicUrl,
    });

    const pdfFileName = `${token}.pdf`;
    const pngFileName = `${token}.png`;
    const jpgFileName = `${token}.jpg`;
    const previewFileName = `${token}-preview.png`;

    const pdfPath = path.join(QR_FLYERS_DIR, pdfFileName);
    const pngPath = path.join(QR_FLYERS_DIR, pngFileName);
    const jpgPath = path.join(QR_FLYERS_DIR, jpgFileName);
    const previewPath = path.join(QR_FLYERS_DIR, previewFileName);

    await takeScreenshot(html, pdfPath, 'pdf');
    await takeScreenshot(html, previewPath, 'png');
    await takeScreenshot(html, pngPath, 'png');
    await takeScreenshot(html, jpgPath, 'jpeg');

    let flyer;
    if (guestProperty) {
      flyer = {
        _id: `guest-flyer-${token}`,
        ownerId: userId,
        propertyId: guestProperty.propertyId,
        selectedPhoto: normalizePhoto(selectedPhoto, 0),
        selectedMetrics,
        displayedMetricsSnapshot: selectedMetricsSnapshot,
        publicUrl,
        previewImageUrl: `${BACK_WEB_URL}/qr-flyers/${previewFileName}`,
        pdfUrl: `${BACK_WEB_URL}/qr-flyers/${pdfFileName}`,
        pngUrl: `${BACK_WEB_URL}/qr-flyers/${pngFileName}`,
        jpgUrl: `${BACK_WEB_URL}/qr-flyers/${jpgFileName}`,
        token,
        status: 'ready',
        scansCount: 0,
      };
    } else {
      flyer = await db.qrFlyers.create({
        ownerId: userId,
        propertyId: property._id,
        selectedPhoto: normalizePhoto(selectedPhoto, 0),
        selectedMetrics,
        displayedMetricsSnapshot: selectedMetricsSnapshot,
        publicUrl,
        previewImageUrl: `${BACK_WEB_URL}/qr-flyers/${previewFileName}`,
        pdfUrl: `${BACK_WEB_URL}/qr-flyers/${pdfFileName}`,
        pngUrl: `${BACK_WEB_URL}/qr-flyers/${pngFileName}`,
        jpgUrl: `${BACK_WEB_URL}/qr-flyers/${jpgFileName}`,
        token,
        status: 'ready',
      });
    }

    return res.json({
      success: true,
      data: {
        id: flyer._id,
        status: flyer.status,
        propertyId: flyer.propertyId,
        previewImageUrl: flyer.previewImageUrl,
        downloads: {
          pdf: `/property/qr-code/flyers/${flyer._id}/download?format=pdf`,
          png: `/property/qr-code/flyers/${flyer._id}/download?format=png`,
          jpg: `/property/qr-code/flyers/${flyer._id}/download?format=jpg`,
        },
        scansCount: flyer.scansCount,
      },
    });
  } catch (err) {
    console.error('QR Flyer error:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.downloadFlyer = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    const flyerId = req.params.flyerId;
    const format = (req.query.format || 'pdf').toLowerCase();
    if (!['pdf', 'png', 'jpg'].includes(format)) {
      return res.status(400).json({ success: false, message: 'Format de téléchargement invalide' });
    }

    let flyer = await db.qrFlyers.findOne({ _id: flyerId, ownerId: userId, isDeleted: false }).lean();
    if (!flyer && flyerId.startsWith('guest-flyer-') && (req.isGuest || userId === 'guest-user-000')) {
      const token = flyerId.replace('guest-flyer-', '');
      flyer = {
        _id: flyerId,
        pdfUrl: `${BACK_WEB_URL}/qr-flyers/${token}.pdf`,
        pngUrl: `${BACK_WEB_URL}/qr-flyers/${token}.png`,
        jpgUrl: `${BACK_WEB_URL}/qr-flyers/${token}.jpg`,
      };
    }

    if (!flyer) {
      return res.status(404).json({ success: false, message: 'Flyer introuvable' });
    }

    const fileName = format === 'pdf' ? flyer.pdfUrl : format === 'png' ? flyer.pngUrl : flyer.jpgUrl;
    if (!fileName) {
      return res.status(404).json({ success: false, message: 'Fichier non disponible' });
    }

    const filename = fileName.split('/').pop();
    const filePath = path.join(QR_FLYERS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fichier introuvable sur le serveur' });
    }

    return res.download(filePath, filename);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.deleteFlyer = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
    const flyerId = req.params.flyerId;
    const flyer = await db.qrFlyers.findOne({ _id: flyerId, ownerId: userId, isDeleted: false });
    if (!flyer) {
      return res.status(404).json({ success: false, message: 'Flyer introuvable' });
    }

    flyer.isDeleted = true;
    await flyer.save();
    return res.json({ success: true, message: 'Flyer supprimé' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.trackQr = async (req, res) => {
  try {
    const token = req.params.token;
    const flyer = await db.qrFlyers.findOne({ token, isDeleted: false });
    if (!flyer) {
      return res.status(404).send('QR Code invalide');
    }

    flyer.scansCount = (flyer.scansCount || 0) + 1;
    flyer.lastScanAt = new Date();
    await flyer.save();
    return res.redirect(flyer.publicUrl || FRONT_WEB_URL);
  } catch (err) {
    return res.status(500).send('Erreur serveur');
  }
};
