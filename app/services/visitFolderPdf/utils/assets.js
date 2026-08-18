// services/visitFolderPdf/utils/assets.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PUBLIC_DIR = path.join(__dirname, "../../../../public");

const imageCache = new Map();

// Ajoute des images pré-optimisées (fileName -> dataURL) au cache.
function addImageCache(entries = []) {
  for (const [file, dataUrl] of entries) {
    if (file && dataUrl) imageCache.set(file, dataUrl);
  }
}

function fileToDataUrl(absPath) {
  try {
    if (!absPath || !fs.existsSync(absPath)) return "";
    const ext = path.extname(absPath).toLowerCase().replace(".", "");
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "gif"
        ? "image/gif"
        : "image/webp";
    const data = fs.readFileSync(absPath);
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return "";
  }
}

// Redimensionne et compresse une image (JPEG) pour le PDF.
async function optimizeToDataUrl(absPath, options = {}) {
  const { width = 1000, quality = 72 } = options;
  try {
    if (!absPath || !fs.existsSync(absPath)) return "";
    const data = await sharp(absPath, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, progressive: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
    return `data:image/jpeg;base64,${data.toString("base64")}`;
  } catch {
    return fileToDataUrl(absPath);
  }
}

// Prépare le cache d'images optimisées pour un dossier donné (photos + plans).
async function optimizeImagesForPdf(files = [], options = {}) {
  const entries = [];
  for (const file of files.filter(Boolean)) {
    const dataUrl = await optimizeToDataUrl(path.join(PUBLIC_DIR, "img", file), options);
    if (dataUrl) entries.push([file, dataUrl]);
  }
  addImageCache(entries);
  return entries;
}

function imgSrc(file) {
  if (imageCache.has(file)) return imageCache.get(file);
  return fileToDataUrl(path.join(PUBLIC_DIR, "img", file));
}

module.exports = {
  imgSrc,
  fileToDataUrl,
  optimizeImagesForPdf,
  addImageCache,
  PUBLIC_DIR,
};
