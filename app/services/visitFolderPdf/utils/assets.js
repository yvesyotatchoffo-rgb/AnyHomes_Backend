// services/visitFolderPdf/utils/assets.js
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "../../../../public");

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

function imgSrc(file) {
  if (!file) return "";
  return fileToDataUrl(path.join(PUBLIC_DIR, "img", file));
}

module.exports = {
  imgSrc,
  fileToDataUrl,
  PUBLIC_DIR,
};
