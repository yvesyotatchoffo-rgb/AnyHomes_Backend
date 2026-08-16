// services/visitFolderPdf/components/zones.js
const { icon } = require("../utils/icons");

function zoneList(zones = []) {
  return zones
    .map(
      (zone) => `
      <div class="zone">
        <h3>${zone.title}</h3>
        <div class="zone-grid">
          ${zone.items
            .map(
              (item) => `
            <div class="zone-item">
              ${icon(item.icon, 22)}
              <p>${item.label}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `
    )
    .join("");
}

module.exports = { zoneList };
