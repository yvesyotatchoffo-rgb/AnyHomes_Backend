// services/visitFolderPdf/components/primitives.js
function renderPage({ className = "page", body = "", showOrb = true, footerLogo = "", footerLogoClassName = "" }) {
  return `
    <section class="${className}">
      ${showOrb ? `<div class="brand-orb"></div>` : ""}
      ${body}
      ${footerLogo ? `<img class="footer-logo ${footerLogoClassName}" src="${footerLogo}" alt="" />` : ""}
    </section>
  `;
}

function renderStandardPage({ subtitle, title, titleClassName = "", content, footerLogo = "", footerLogoClassName = "", shellClassName = "" }) {
  return renderPage({
    footerLogo,
    footerLogoClassName,
    body: `
      <div class="page-shell ${shellClassName}">
        <div class="page-subtitle">${subtitle}</div>
        <div class="page-title ${titleClassName}">${title}</div>
        ${content}
      </div>
    `,
  });
}

function renderPanel(html, className = "") {
  return `<div class="panel ${className}">${html}</div>`;
}

module.exports = {
  renderPage,
  renderStandardPage,
  renderPanel,
};
