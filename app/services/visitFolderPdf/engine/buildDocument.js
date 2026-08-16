// services/visitFolderPdf/engine/buildDocument.js
const { baseStyles } = require("../theme/baseStyles");
const { pageCover } = require("../pages/page1-cover");
const { pageFeatures } = require("../pages/page2-features");
const { pagePhotos } = require("../pages/page3-photos");
const { pagePlans } = require("../pages/page3b-plans");
const { pageEnvironment } = require("../pages/page4-environment");
const { pageFigures } = require("../pages/page5-figures");
const { pageNextSteps } = require("../pages/page6-nextSteps");
const { pagePlatform } = require("../pages/page7-platform");

function buildDocument(vm) {
  const pages = [
    pageCover(vm),
    pageFeatures(vm),
    vm.sections.photos.length > 1 ? pagePhotos(vm) : "",
    vm.sections.plans && vm.sections.plans.length ? pagePlans(vm) : "",
    hasEnvironmentContent(vm) ? pageEnvironment(vm) : "",
    pageFigures(vm),
    pageNextSteps(vm),
    pagePlatform(vm),
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${baseStyles(vm.brand)}</style>
</head>
<body>${pages}</body>
</html>`;
}

function hasEnvironmentContent(vm) {
  return Boolean(
    vm.sections.visitHighlights ||
      vm.sections.neighborhood ||
      vm.sections.practicalLife ||
      vm.sections.condominium
  );
}

module.exports = { buildDocument };
