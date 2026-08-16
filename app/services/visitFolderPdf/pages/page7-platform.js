// services/visitFolderPdf/pages/page7-platform.js
const { renderPage } = require("../components/primitives");
const { zoneList } = require("../components/zones");

function pagePlatform(vm) {
  const zones = [
    {
      title: "Piloter votre projet immobilier",
      items: [
        { icon: "LayoutDashboard", label: "Tableau de bord et To-do liste" },
        { icon: "Compass", label: "Parcours immobilier digital" },
        { icon: "UserCheck", label: "Analyse fiabilité des candidats" },
      ],
    },
    {
      title: "Vous faire accompagner",
      items: [
        { icon: "Sparkles", label: "Coach immo IA" },
        { icon: "BookOpen", label: "Contenu de formation" },
        { icon: "Briefcase", label: "Agents immo à la carte" },
      ],
    },
    {
      title: "Accélérer votre projet immobilier",
      items: [
        { icon: "Home", label: "Annuaire des biens immo" },
        { icon: "TrendingUp", label: "Baromètre prix entre particuliers" },
        { icon: "History", label: "Historique des transactions" },
        { icon: "Heart", label: "Wish liste immo" },
        { icon: "UserCheck", label: "Outils candidats" },
        { icon: "Building", label: "Outils propriétaires" },
      ],
    },
  ];

  return renderPage({
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    body: `
      <div class="page-shell page-shell--top-spaced">
        ${vm.brand.logoDark ? `<img src="${vm.brand.logoDark}" alt="" style="height:104px;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto;" />` : ""}
        <div class="cover-label" style="margin-bottom:8px;">
          Vendre ou acheter seul et sans commission en étant bien accompagné
        </div>
        <div class="page-title page-title--badge">Plateforme tout-en-un</div>
        ${zoneList(zones)}
        <div class="site-url">${vm.brand.url || "www.anyhomes.fr"}</div>
      </div>
    `,
  });
}

module.exports = { pagePlatform };
