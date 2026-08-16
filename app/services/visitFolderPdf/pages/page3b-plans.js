// services/visitFolderPdf/pages/page3b-plans.js
const { renderStandardPage } = require("../components/primitives");
const { imgSrc } = require("../utils/assets");

function pagePlans(vm) {
  const plans = vm.sections.plans || [];

  return renderStandardPage({
    subtitle: "Plan du bien",
    title: "Projetez-vous grâce à ce plan du bien",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      <div class="plans-grid">
        ${plans
          .map((plan) => `<img src="${imgSrc(plan.fileName)}" alt="Plan du bien" />`)
          .join("")}
      </div>
    `,
  });
}

module.exports = { pagePlans };
