// services/visitFolderPdf/pages/page2-features.js
const { renderStandardPage, renderPanel } = require("../components/primitives");
const { iconRows } = require("../components/blocks");

function pageFeatures(vm) {
  return renderStandardPage({
    subtitle: "Caractéristiques du bien",
    title: "Retrouvez les prestations de ce bien",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      <div class="section-title">Description du bien</div>
      ${renderPanel(vm.listing.descriptionHtml)}

      ${
        vm.sections.spaces.length
          ? `
      <div class="section-title">Superficie des principaux espaces du bien</div>
      <div class="grid-3">
        ${iconRows(
          vm.sections.spaces.map((item) => ({
            icon: item.icon || "Ruler",
            label: item.label,
            value: `${item.surface} m²`,
          }))
        )}
      </div>
      `
          : ""
      }

      <div class="section-title">Les différentes prestations du bien</div>
      <div class="grid-3">
        ${iconRows(vm.sections.prestations)}
      </div>
    `,
  });
}

module.exports = { pageFeatures };
