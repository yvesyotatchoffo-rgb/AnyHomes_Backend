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
    id: getPhotoIdentifier(photo, index),
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

async function renderFlyerHtml({ selectedPhotoUrl, qrCodeDataUrl, propertyRef }) {
  const logoUrl = `${BACK_WEB_URL}/anyhomes-logo-white.png`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>AnyHomes QR Poster</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { margin: 0; padding: 0; width: 1600px; height: 1200px; overflow: hidden; background: #111; }
      .poster { position: relative; width: 1600px; height: 1200px; overflow: hidden; font-family: Arial, Helvetica, sans-serif; }
      .bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
      .left-overlay { position: absolute; left: 0; top: 0; width: 60%; height: 100%; background: rgba(0,0,0,0.62); z-index: 1; }
      .content { position: absolute; top: 0; left: 0; bottom: 0; width: 60%; z-index: 2; display: flex; flex-direction: column; justify-content: space-between; padding: 270px 64px 40px 64px; }
      .headline { color: #fff; font-size: 60px; font-weight: 900; text-transform: uppercase; line-height: 1.05; letter-spacing: -1px; margin-bottom: 28px; }
      .subtext { color: #fff; font-size: 34px; font-weight: 700; line-height: 1.45; margin-bottom: 28px; max-width: 660px; }
      .bullets { list-style: none; padding: 0; margin: 0; }
      .bullets li { color: #fff; font-size: 32px; line-height: 1.55; padding-left: 30px; position: relative; margin-bottom: 12px; }
      .bullets li::before { content: '•'; position: absolute; left: 0; }
      .bullets li strong { font-weight: 700; }
      .logo-block { color: #fff; display: flex; flex-direction: column; align-items: flex-start; position: relative; left: -30px; top: 30px; }
      .logo-img { height: 102px; width: auto; display: block; margin-bottom: 4px; }
      .logo-tagline { font-size: 26px; font-weight: 800; line-height: 1.45; color: #fff; margin-left: 24px; position: relative; top: -25px; }
      .qr-card { position: absolute; top: 50%; left: 80%; transform: translate(-50%, -50%); z-index: 3; background: #fff; border-radius: 32px; padding: 46px 24px 40px 24px; display: flex; flex-direction: column; align-items: center; min-width: 504px; box-shadow: 0 8px 40px rgba(0,0,0,0.22); }
      .qr-img { width: 359px; height: 359px; display: block; }
      .qr-label { font-size: 32px; font-weight: 700; color: #111; text-align: center; margin-top: 24px; line-height: 1.35; max-width: 500px; }
      .qr-sublabel { font-size: 22px; color: #555; text-align: center; margin-top: 10px; }
      .qr-ref { font-size: 19px; color: #aaa; text-align: center; margin-top: 8px; letter-spacing: 1px; }
    </style>
  </head>
  <body>
    <div class="poster">
      <img class="bg-img" src="${selectedPhotoUrl || ''}" alt="" />
      <div class="left-overlay"></div>
      <div class="content">
        <div class="top-block">
          <div class="headline">NE VOUS ARR&Ecirc;TEZ PAS<br/>&Agrave; CETTE ANNONCE</div>
          <div class="subtext">D&eacute;couvrez sur AnyHomes.fr ce que cette annonce ne montre pas.</div>
          <ul class="bullets">
            <li><strong>Plus d&rsquo;informations sur le bien :</strong> revenus, d&eacute;penses, travaux r&eacute;alis&eacute;s&hellip;</li>
            <li><strong>Transaction guid&eacute;e</strong> &agrave; chaque &eacute;tape</li>
            <li><strong>Coach IA</strong> pour vous accompagner</li>
          </ul>
        </div>
        <div class="logo-block">
          <img class="logo-img" src="${logoUrl}" alt="AnyHomes" />
          <div class="logo-tagline">Vendre et acheter un bien immobilier<br/>seul en &eacute;tant bien accompagn&eacute;</div>
        </div>
      </div>
      <div class="qr-card">
        <img class="qr-img" src="${qrCodeDataUrl}" alt="QR Code" />
        <div class="qr-label">Scannez pour d&eacute;couvrir<br/>le profil complet</div>
        <div class="qr-sublabel">Acc&egrave;s gratuit sur AnyHomes.fr</div>
        ${propertyRef ? `<div class="qr-ref">R&eacute;f : ${propertyRef}</div>` : ''}
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
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  if (format === 'pdf') {
    await page.pdf({
      path: outputPath,
      width: '1600px',
      height: '1200px',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } else {
    await page.screenshot({
      path: outputPath,
      type: format,
      clip: { x: 0, y: 0, width: 1600, height: 1200 },
    });
  }
  await browser.close();
}

exports.listOwnerProperties = async (req, res) => {
  try {
    const userId = req.identity && req.identity._id;
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
              pdfUrl: latestFlyer.pdfUrl,
              pngUrl: latestFlyer.pngUrl,
              jpgUrl: latestFlyer.jpgUrl,
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
    const userId = req.identity && req.identity._id;
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

    ensureQrFlyerDir();
    const token = generateToken();
    const trackUrl = `${BACK_WEB_URL}/qr/${token}`;
    const qrCodeDataUrl = await qrcode.toDataURL(trackUrl, { errorCorrectionLevel: 'H', margin: 1, width: 360 });
    const selectedPhotoUrl = getPhotoUrl(selectedPhoto);

    const html = await renderFlyerHtml({
      selectedPhotoUrl,
      qrCodeDataUrl,
      propertyRef: property?.propertyRef || null,
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
        selectedMetrics: [],
        displayedMetricsSnapshot: {},
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
        selectedMetrics: [],
        displayedMetricsSnapshot: {},
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

// ─── ADMIN ───────────────────────────────────────────────────────────────────

exports.adminStats = async (req, res) => {
  try {
    const { period = 'day' } = req.query;

    const [totalFlyers, totalScansAgg, flyersWithScans, lastFlyerArr] = await Promise.all([
      db.qrFlyers.countDocuments({ isDeleted: false }),
      db.qrFlyers.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null, total: { $sum: '$scansCount' } } }]),
      db.qrFlyers.countDocuments({ isDeleted: false, scansCount: { $gt: 0 } }),
      db.qrFlyers.find({ isDeleted: false, lastScanAt: { $ne: null } }).sort({ lastScanAt: -1 }).limit(1).lean(),
    ]);

    const totalScans = totalScansAgg[0]?.total || 0;
    const avgScans = totalFlyers > 0 ? (totalScans / totalFlyers).toFixed(1) : 0;
    const lastScanAt = lastFlyerArr[0]?.lastScanAt || null;

    const groupFormat = period === 'month' ? '%Y-%m' : period === 'week' ? '%Y-%U' : '%Y-%m-%d';
    const daysBack = period === 'month' ? 365 : period === 'week' ? 84 : 30;
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const [creationEvolution, scanEvolution] = await Promise.all([
      db.qrFlyers.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      db.qrFlyers.aggregate([
        { $match: { isDeleted: false, lastScanAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: groupFormat, date: '$lastScanAt' } }, scans: { $sum: '$scansCount' } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const allDates = [...new Set([...creationEvolution.map(d => d._id), ...scanEvolution.map(d => d._id)])].sort();
    const creationMap = Object.fromEntries(creationEvolution.map(d => [d._id, d.count]));
    const scanMap = Object.fromEntries(scanEvolution.map(d => [d._id, d.scans]));
    const evolution = allDates.map(date => ({ date, created: creationMap[date] || 0, scans: scanMap[date] || 0 }));

    return res.json({ success: true, data: { totalFlyers, totalScans, flyersWithScans, avgScans, lastScanAt, evolution } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.adminListFlyers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [flyers, total] = await Promise.all([
      db.qrFlyers.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('ownerId', 'firstName lastName email')
        .populate('propertyId', 'title propertyRef city')
        .lean(),
      db.qrFlyers.countDocuments({ isDeleted: false }),
    ]);

    return res.json({ success: true, data: flyers, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
