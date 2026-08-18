// services/visitFolderPdf/pages/page5-figures.js
const { renderStandardPage } = require("../components/primitives");
const { figureBox, docsGrid } = require("../components/tables");

function pageFigures(vm) {
  const orderedTitles = [
    ["bien", "Le bien"],
    ["energie", "Énergie"],
    ["revenus", "Revenus"],
    ["depenses", "Dépenses courantes"],
    ["travaux", "Travaux et rénovations"],
  ];

  const tableMap = new Map((vm.sections.tables || []).map((table) => [table.key, table.rows || []]));
  const boxes = orderedTitles
    .filter(([key]) => tableMap.has(key) && tableMap.get(key).length)
    .map(([key, title]) => figureBox(title, tableMap.get(key)))
    .concat(
      (vm.sections.externalRatings || []).length
        ? figureBox("Notations", vm.sections.externalRatings)
        : []
    )
    .join("");

  return renderStandardPage({
    subtitle: "Les éléments chiffrés",
    title: "Rassurez-vous en consultant les éléments chiffrés et les documents clés",
    titleClassName: "page-title--spaced",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      ${boxes ? `<div class="figures-grid">${boxes}</div>` : ""}
      ${docsGrid(vm.sections.selectedDocuments)}
    `,
  });
}

module.exports = { pageFigures };
