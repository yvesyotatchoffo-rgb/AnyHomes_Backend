// services/visitFolderPdf/components/blocks.js
const { renderPanel } = require("./primitives");
const { icon } = require("../utils/icons");

function iconRows(items = []) {
  if (!items.length) {
    return `<p class="vf-value">Aucune donnée renseignée.</p>`;
  }

  return items
    .map(
      (item) => `
      <div class="vf-row">
        ${icon(item.icon || "Sparkles", 16)}
        <span class="vf-label">${item.label || ""}</span>
        ${item.value ? `<span class="vf-value">${item.value}</span>` : ""}
      </div>
    `
    )
    .join("");
}

function labeledRichBlock(title, html) {
  if (!html) return "";
  return `
    <div class="env-block">
      <div class="env-title">${title}</div>
      ${renderPanel(html, "panel--alt")}
    </div>
  `;
}

module.exports = {
  iconRows,
  labeledRichBlock,
};
