// services/visitFolderPdf/pages/page6-nextSteps.js
const { renderStandardPage } = require("../components/primitives");
const { stepList } = require("../components/steps");

function pageNextSteps(vm) {
  const steps =
    vm.destination === "rent"
      ? [
          { icon: "Star", title: "Évaluer la visite", text: "Laissez un avis après la visite pour partager votre ressenti." },
          { icon: "Eye", title: "Demander une contre-visite", text: "Cette visite va vous permettre de confirmer votre ressenti de la première visite." },
          { icon: "FileText", title: "Envoyer votre candidature", text: "Soumettez votre candidature en partageant votre dossier locataire." },
          { icon: "Handshake", title: "Suivre votre candidature", text: "Le propriétaire répond à votre candidature sur l'application." },
        ]
      : [
          { icon: "Star", title: "Évaluer la visite", text: "Laissez un avis après la visite pour partager votre ressenti." },
          { icon: "FileText", title: "Demander le dossier vendeur", text: "Il contient les documents qui vont vous permettre de mieux appréhender le bien." },
          { icon: "Eye", title: "Demander une contre-visite", text: "Cette visite va vous permettre de confirmer votre ressenti de la première visite." },
          { icon: "Euro", title: "Faire une offre", text: "Transmettez de manière sécurisée votre offre d'achat avec toutes les informations requises." },
          { icon: "Handshake", title: "Suivre votre offre", text: "Le propriétaire répond à votre offre dans l'application." },
        ];

  return renderStandardPage({
    subtitle: "Ce bien vous intéresse ?",
    title: "Voici la marche à suivre pour concrétiser cette opportunité",
    footerLogo: vm.brand.logoDark,
    footerLogoClassName: "footer-logo--lg",
    content: `
      <div class="next-steps-intro">
        <div class="badge">Mon parcours immo digital</div>
        <p class="next-steps-lead">
          C'est simple, toutes les étapes se passent dans l'application
        </p>
      </div>

      ${stepList(steps)}
      ${
        vm.listing.qrDataUrl
          ? `<div class="next-steps-qr">
              <img src="${vm.listing.qrDataUrl}" alt="" />
              <span class="next-steps-qr-text">Scanner pour poursuivre sur l'application</span>
            </div>`
          : ""
      }
    `,
  });
}

module.exports = { pageNextSteps };
