// services/visitFolderPdf/index.js
const { buildPdfViewModel } = require("./adapters/buildPdfViewModel");
const { buildDocument } = require("./engine/buildDocument");
const { generatePdf } = require("./engine/generatePdf");

function buildHtml(snapshot, destination, selectedPhotos, property, ctx) {
  const viewModel = buildPdfViewModel({
    snapshot,
    destination,
    selectedPhotos,
    property,
    ctx,
  });

  return buildDocument(viewModel);
}

module.exports = {
  buildHtml,
  generatePdf,
};
