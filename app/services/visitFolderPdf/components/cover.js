// services/visitFolderPdf/components/cover.js
const { imgSrc } = require("../utils/assets");
const { icon } = require("../utils/icons");

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metricRow(iconName, value) {
  if (!value) return "";
  return `
    <div class="cover-fixed-metric">
      <span class="cover-fixed-metric-icon">${icon(iconName, 16)}</span>
      <span class="cover-fixed-metric-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function valorizationIcon(index) {
  const icons = [
    "Sparkles",
    "MapPin",
    "Euro",
    "ChefHat",
    "Leaf",
    "Sun",
    "Bus",
    "Wind",
  ];
  return icon(icons[index % icons.length], 14);
}

function renderValorizationItems(vm) {
  const items = (vm.sections.valorizationItems || []).slice(0, 10);

  return items
    .map((item, index) => {
      const label = typeof item === "string" ? item : item?.label || "";
      return `
        <div class="cover-fixed-valorization-item">
          <span class="cover-fixed-valorization-icon">${valorizationIcon(index)}</span>
          <span class="cover-fixed-valorization-text">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");
}

function renderCoverPhoto(vm) {
  const coverPhoto = vm.sections.photos?.[0]?.fileName
    ? imgSrc(vm.sections.photos[0].fileName)
    : "";

  if (!coverPhoto) {
    return `<div class="cover-fixed-photo cover-fixed-photo--fallback"></div>`;
  }

  return `<img class="cover-fixed-photo" src="${coverPhoto}" alt="Photo principale du bien" />`;
}

function renderQr(vm) {
  if (!vm.listing.qrDataUrl) return "";

  return `
    <div class="cover-fixed-qr">
      <img src="${vm.listing.qrDataUrl}" alt="QR code du bien" />
      <div class="cover-fixed-qr-copy">
        Scannez ce QR code<br />
        pour retrouver ce bien
      </div>
    </div>
  `;
}

function renderFooterLogo(vm) {
  if (!vm.brand.logoDark && !vm.brand.logoLight) return "";
  const src = vm.brand.logoDark || vm.brand.logoLight;

  return `
    <div class="cover-fixed-footer-logo">
      <img src="${src}" alt="${escapeHtml(vm.brand.name || "Logo")}" />
    </div>
  `;
}

function renderFixedCover(vm) {
  return `
    <section class="cover-fixed">
      <div class="cover-fixed-top">
        ${renderCoverPhoto(vm)}
      </div>

      <div class="cover-fixed-bottom">
        <div class="cover-fixed-left">
          <div class="cover-fixed-label">Dossier de visite</div>
          <h1 class="cover-fixed-title">${escapeHtml(vm.listing.title || "")}</h1>
          <div class="cover-fixed-address">${escapeHtml(vm.listing.address || "")}</div>
          <div class="cover-fixed-owner">
            ${escapeHtml(vm.listing.ownerName || "")}
            ${vm.listing.ownerPhone ? ` · ${escapeHtml(vm.listing.ownerPhone)}` : ""}
          </div>

          <div class="cover-fixed-valorization-title">Éléments de valorisation du bien</div>
          <div class="cover-fixed-valorization-list">
            ${renderValorizationItems(vm)}
          </div>
        </div>

        <div class="cover-fixed-divider"></div>

        <div class="cover-fixed-right">
          <div class="cover-fixed-status-wrap">
            <span class="badge cover-fixed-status">${escapeHtml(vm.listing.statusLabel || "")}</span>
          </div>

          <div class="cover-fixed-price">${escapeHtml(vm.listing.priceValue || "")}</div>

          <div class="cover-fixed-metrics">
            ${metricRow("Ruler", vm.listing.surface)}
            ${metricRow("DoorOpen", vm.listing.rooms)}
            ${metricRow("BedDouble", vm.listing.bedrooms)}
            ${metricRow("Leaf", vm.listing.dpe)}
          </div>
        </div>
      </div>

      ${renderQr(vm)}
      ${renderFooterLogo(vm)}
    </section>
  `;
}

module.exports = {
  renderFixedCover,
};
