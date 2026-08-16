// services/visitFolderPdf/pages/page3-photos.js
const { renderStandardPage } = require("../components/primitives");
const { imgSrc } = require("../utils/assets");

function pagePhotos(vm) {
  return renderStandardPage({
    subtitle: "Photos marquantes du bien",
    title: "Revivez les instants marquants de la visite",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      <div class="photo-grid">
        ${vm.sections.photos
          .map(
            (photo) => `
          <img src="${imgSrc(photo.fileName)}" alt="" />
        `
          )
          .join("")}
      </div>
    `,
  });
}

module.exports = { pagePhotos };
