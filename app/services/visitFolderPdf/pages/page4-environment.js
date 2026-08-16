// services/visitFolderPdf/pages/page4-environment.js
const { renderStandardPage } = require("../components/primitives");
const { labeledRichBlock } = require("../components/blocks");

function pageEnvironment(vm) {
  return renderStandardPage({
    subtitle: "Environnement et cadre de vie",
    title: "Projetez-vous dans l'usage de ce bien grâce à ces informations",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      ${labeledRichBlock("Rappel des temps forts de la visite", vm.sections.visitHighlights)}
      ${labeledRichBlock("La vie dans le quartier", vm.sections.neighborhood)}
      ${labeledRichBlock("Vie pratique", vm.sections.practicalLife)}
      ${labeledRichBlock("La copropriété", vm.sections.condominium)}
    `,
  });
}

module.exports = { pageEnvironment };
