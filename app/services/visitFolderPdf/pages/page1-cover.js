// services/visitFolderPdf/pages/page1-cover.js
const { renderPage } = require("../components/primitives");
const { renderFixedCover } = require("../components/cover");

function pageCover(vm) {
  return renderPage({
    className: "page cover-page cover-page--fixed",
    showOrb: false,
    body: renderFixedCover(vm),
  });
}

module.exports = { pageCover };
