// Crée la gamme de templates transactionnels white-label dans Brevo.
// Utilise l'API REST directement (le SDK @getbrevo/brevo est instable pour
// la gestion des templates).
//
// Nommage : chaque template est préfixé [White-Label] pour être clairement
// identifié comme destiné aux sites vitrines (marques blanches).
//
// Les templates sont génériques : le logo, la couleur et le nom de la marque
// sont injectés au moment de l'envoi via les params Brevo :
//   {{params.logoUrl}}, {{params.buttonColor}}, {{params.primaryColor}},
//   {{params.appName}}, {{params.agencyName}}
//
// Usage : node scripts/create-white-label-templates.js
// La clé API est lue depuis le .env (BREVO_API_KEY).

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const API_KEY = process.env.BREVO_API_KEY;
const SENDER = {
  name: "AnyHomes",
  email: process.env.BREVO_AUTH_FROM_EMAIL || "notifications@anyhomes.fr",
};

const BASE_URL = "https://api.brevo.com/v3";

async function api(method, url, body) {
  const res = await fetch(BASE_URL + url, {
    method,
    headers: { "api-key": API_KEY, accept: "application/json", "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Layout partagé ──────────────────────────────────────────────────────────
function layout(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{params.appName}}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:28px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6e8ef;">
        <tr>
          <td align="center" style="padding:36px 40px 12px;">
            <img src="{{params.logoUrl}}" alt="{{params.appName}}" width="160" style="max-height:64px;width:auto;border:0;"/>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:0 40px 8px;">
            <div style="width:56px;height:4px;border-radius:2px;background:{{params.buttonColor}};margin:0 auto;"></div>
          </td>
        </tr>
${bodyHtml}
        <tr>
          <td align="center" style="padding:28px 40px 24px;border-top:1px solid #eef0f5;background:#fafbfd;">
            <p style="margin:0;font-size:12px;color:#8a8f9c;line-height:1.6;">
              © {{params.agencyName}} — Tous droits réservés<br/>
              <span style="color:#aab0bb;">Vous recevez cet email dans le cadre de votre utilisation de la plateforme {{params.appName}}.</span>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function greeting(name) {
  return `<p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:.06em;color:#8a8f9c;text-transform:uppercase;">Bonjour</p>
<p style="margin:0 0 14px;font-size:22px;font-weight:bold;color:#22262f;line-height:1.3;">${name}</p>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 18px;font-size:15px;color:#5a6270;line-height:1.7;">${text}</p>`;
}

function otpBox(code) {
  return `<div style="padding:20px 24px;border-radius:12px;background:#faf6ff;border:1px dashed {{params.primaryColor}};text-align:center;margin:0 0 18px;">
<span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:{{params.primaryColor}};">${code}</span>
</div>`;
}

function ctaButton(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 20px;">
<tr><td align="center" style="border-radius:999px;background:{{params.buttonColor}};">
<a href="${href}" style="display:inline-block;padding:14px 40px;border-radius:999px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr>
</table>`;
}

function infoBox(rowsHtml) {
  return `<div style="margin:0 0 18px;padding:18px 22px;border-radius:12px;background:#f8f9fb;border:1px solid #eef0f5;font-size:14px;line-height:1.8;color:#3a4050;">
${rowsHtml}
</div>`;
}

function credentialsBox(email, password) {
  return infoBox(`<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#22262f;">Vos identifiants de connexion</p>
<p style="margin:0;"><strong>Email :</strong> ${email}</p>
<p style="margin:0;"><strong>Mot de passe :</strong> ${password}</p>`);
}

function statCard(label, value, evol, color) {
  return `<td align="center" style="padding:14px 8px;background:#f8f9fb;border:1px solid #eef0f5;border-radius:10px;">
<p style="margin:0 0 6px;font-size:11px;color:#8a8f9c;text-transform:uppercase;letter-spacing:.05em;">${label}</p>
<p style="margin:0;font-size:22px;font-weight:bold;color:#22262f;">${value}</p>
<p style="margin:2px 0 0;font-size:12px;color:${color};">${evol}</p>
</td>`;
}

// ── Définition des templates ────────────────────────────────────────────────
const TEMPLATES = [
  {
    key: "SEND_VERIFICATION_OTP",
    name: "[White-Label] Code de vérification OTP",
    subject: "Votre code de vérification {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Vous avez demandé la vérification de votre compte sur <strong>{{params.appName}}</strong>. Voici votre code de vérification :")}
${otpBox("{{params.otp}}")}
${paragraph("Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.")}
          </td>
        </tr>`,
  },
  {
    key: "VERIFICATION_OTP",
    name: "[White-Label] Renvoi du code de vérification",
    subject: "Votre nouveau code de vérification {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Voici votre nouveau code de vérification pour <strong>{{params.appName}}</strong> :")}
${otpBox("{{params.otp}}")}
${paragraph("Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.")}
          </td>
        </tr>`,
  },
  {
    key: "USER_VERIFICATION_LINK",
    name: "[White-Label] Vérification de l'adresse email",
    subject: "Vérification de votre adresse e-mail {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Merci de vous être inscrit(e) sur <strong>{{params.appName}}</strong>. Pour activer votre compte, utilisez le code de vérification ci-dessous :")}
${otpBox("{{params.otp}}")}
${paragraph("Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.")}
          </td>
        </tr>`,
  },
  {
    key: "WELCOME_USER",
    name: "[White-Label] Bienvenue",
    subject: "Bienvenue sur {{params.appName}} !",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.email}}")}
${paragraph("Bienvenue sur <strong>{{params.appName}}</strong> ! Votre compte est maintenant prêt. Connectez-vous pour découvrir toutes les fonctionnalités à votre disposition.")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "FORGOT_PASSWORD_USER",
    name: "[White-Label] Réinitialisation du mot de passe",
    subject: "Réinitialisez votre mot de passe {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.firstName}}")}
${paragraph("Vous avez demandé la réinitialisation de votre mot de passe sur <strong>{{params.appName}}</strong>. Utilisez le code ci-dessous puis le bouton pour choisir un nouveau mot de passe :")}
${otpBox("{{params.verificationCode}}")}
${ctaButton("Réinitialiser le mot de passe", "{{params.resetUrl}}")}
${paragraph("Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.")}
          </td>
        </tr>`,
  },
  {
    key: "OTP_FOR_CHANGE_EMAIL_WEB",
    name: "[White-Label] Confirmation de changement d'adresse email",
    subject: "Confirmez votre nouvelle adresse email",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Vous avez demandé le remplacement de votre adresse email <strong>{{params.currentEmail}}</strong> par <strong>{{params.newEmail}}</strong> sur {{params.appName}}. Cliquez sur le bouton ci-dessous pour confirmer cette modification :")}
${ctaButton("Confirmer ma nouvelle adresse", "{{params.confirmationUrl}}")}
${paragraph("Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.")}
          </td>
        </tr>`,
  },
  {
    key: "CHANGE_PASSWORD_CONFIRMATION",
    name: "[White-Label] Confirmation de changement de mot de passe",
    subject: "Votre mot de passe a été modifié avec succès",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre mot de passe pour <strong>{{params.appName}}</strong> a bien été modifié. Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement le support.")}
          </td>
        </tr>`,
  },
  {
    key: "CONTACT_US_NOTIFICATION",
    name: "[White-Label] Notification de demande de contact",
    subject: "Nouvelle demande de contact",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Une personne souhaite vous contacter à propos d'un bien sur <strong>{{params.appName}}</strong>. Voici ses coordonnées :")}
<div style="margin:0 0 18px;padding:16px 20px;border-radius:12px;background:#f8f9fb;border:1px solid #eef0f5;">
<p style="margin:0 0 6px;font-size:14px;color:#22262f;"><strong>Nom :</strong> {{params.userName}}</p>
<p style="margin:0;font-size:14px;color:#22262f;"><strong>Email :</strong> {{params.useremail}}</p>
</div>
          </td>
        </tr>`,
  },
  {
    key: "WHITE_LABEL_INVITATION",
    name: "[White-Label] Invitation à rejoindre l'agence",
    subject: "{{params.agencyName}} vous invite à rejoindre sa plateforme",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.agencyName}} vous invite !")}
${paragraph("{{params.agencyName}} met à votre disposition la plateforme <strong>{{params.appName}}</strong> pour vous accompagner dans votre projet immobilier. Créez votre compte pour accéder aux outils transactionnels, au coach IA et aux services de votre agence.")}
${ctaButton("Créer mon compte", "{{params.inviteLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "NEW_MESSAGE_NOTIFICATION",
    name: "[White-Label] Notification de nouveau message",
    subject: "Nouveau message de {{params.senderName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.recipientName}}")}
${paragraph("<strong>{{params.senderName}}</strong> vous a envoyé un message à propos de « {{params.propertyTitle}} » sur {{params.appName}}.")}
<div style="margin:0 0 18px;padding:14px 18px;border-radius:12px;background:#f8f9fb;border:1px solid #eef0f5;font-size:14px;color:#3a4050;font-style:italic;">{{params.messagePreview}}</div>
${ctaButton("Voir la conversation", "{{params.chatUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "SERVICE_ORDER_CONFIRMATION",
    name: "[White-Label] Confirmation de commande service",
    subject: "Votre commande est confirmée — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.buyerName}}")}
${paragraph("Votre commande du service <strong>{{params.serviceTitle}}</strong> auprès de <strong>{{params.proName}}</strong> est confirmée.")}
${infoBox(`<p style="margin:0;"><strong>Service :</strong> {{params.serviceTitle}}</p>
<p style="margin:0;"><strong>Quantité :</strong> {{params.quantity}}</p>
<p style="margin:0;"><strong>Montant total TTC :</strong> {{params.totalPriceTTC}}</p>
<p style="margin:0;"><strong>N° de commande :</strong> {{params.orderId}}</p>`)}
          </td>
        </tr>`,
  },
  {
    key: "SERVICE_DELIVERED_BUYER",
    name: "[White-Label] Service livré — confirmation acheteur",
    subject: "Votre service a été livré — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.buyerName}}")}
${paragraph("<strong>{{params.proName}}</strong> a marqué le service <strong>{{params.serviceTitle}}</strong> comme livré.")}
${paragraph("{{params.deliveryMessage}}")}
${ctaButton("Confirmer la livraison", "{{params.confirmUrl}}")}
${paragraph("<em>Commande N° {{params.orderId}} — votre confirmation libère le paiement du prestataire.</em>")}
          </td>
        </tr>`,
  },
  {
    key: "SERVICE_DELIVERED_PRO",
    name: "[White-Label] Livraison enregistrée — prestataire",
    subject: "Livraison enregistrée — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.proName}}")}
${paragraph("Vous avez signalé la livraison du service <strong>{{params.serviceTitle}}</strong>. Elle est en attente de confirmation de l'acheteur.")}
${infoBox(`<p style="margin:0;"><strong>N° de commande :</strong> {{params.orderId}}</p>`)}
          </td>
        </tr>`,
  },
  {
    key: "SERVICE_PAYMENT_RELEASED",
    name: "[White-Label] Paiement libéré",
    subject: "Paiement libéré — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.buyerName}}")}
${paragraph("La commande du service <strong>{{params.serviceTitle}}</strong> est confirmée et le paiement a été libéré.")}
${infoBox(`<p style="margin:0;"><strong>Montant total TTC :</strong> {{params.totalPriceTTC}}</p>
<p style="margin:0;"><strong>Montant versé au prestataire :</strong> {{params.proAmount}}</p>
<p style="margin:0;"><strong>N° de commande :</strong> {{params.orderId}}</p>
<p style="margin:0;"><strong>Date :</strong> {{params.confirmedAt}}</p>`)}
          </td>
        </tr>`,
  },
  {
    key: "LITIGATION_OPENED",
    name: "[White-Label] Litige ouvert",
    subject: "Un litige a été ouvert — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.recipientName}}")}
${paragraph("Un litige a été ouvert sur la commande <strong>{{params.serviceTitle}}</strong> (N° {{params.orderId}}).")}
${infoBox(`<p style="margin:0;"><strong>Initié par :</strong> {{params.initiatedBy}}</p>
<p style="margin:0;"><strong>Date :</strong> {{params.litigationDate}}</p>
<p style="margin:0;"><strong>Description :</strong> {{params.description}}</p>`)}
${paragraph("Notre équipe va prendre en charge votre dossier dans les plus brefs délais.")}
          </td>
        </tr>`,
  },
  {
    key: "CONTRACT_SIGNED_NOTIFICATION",
    name: "[White-Label] Notification de signature de contrat",
    subject: "Contrat signé — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.ownerName}}")}
${paragraph("Le contrat concernant le bien « <strong>{{params.propertyTitle}}</strong> » a été signé par {{params.signerName}}.")}
${ctaButton("Voir le tableau de bord", "{{params.dashboardUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "SUBSCRIPTION_REMINDER",
    name: "[White-Label] Rappel d'abonnement",
    subject: "Votre abonnement — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("{{params.mainText}}")}
${ctaButton("{{params.buttonText}}", "{{params.subscriptionUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "SEND_LOGIN_CREDENTIAL",
    name: "[White-Label] Vos identifiants de connexion",
    subject: "Vos identifiants de connexion — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre compte <strong>{{params.role}}</strong> a été créé sur {{params.appName}}. Voici vos identifiants :")}
${credentialsBox("{{params.email}}", "{{params.password}}")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
${paragraph("Pensez à modifier votre mot de passe après votre première connexion.")}
          </td>
        </tr>`,
  },
  {
    key: "RENTER_TRANSFER_NOTIFICATION",
    name: "[White-Label] Transfert de locataire",
    subject: "Transfert de locataire — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.ownerName}}")}
${paragraph("Le locataire <strong>{{params.renterName}}</strong> a été transféré pour le bien « {{params.propertyTitle}} » ({{params.propertyType}}).")}
${ctaButton("Voir le bien", "{{params.propertyLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "REFERRAL_EMAIL_INVITE",
    name: "[White-Label] Invitation parrainage",
    subject: "{{params.senderFullName}} vous invite sur {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${paragraph("<strong>{{params.senderFullName}}</strong> vous invite à rejoindre <strong>{{params.appName}}</strong>.")}
{{params.personalMessageBlock}}
${ctaButton("Rejoindre", "{{params.inviteUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "PROPERTY_TRANSFER_REQUEST",
    name: "[White-Label] Demande de transfert de propriété",
    subject: "Demande de transfert — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.ownerName}}")}
${paragraph("<strong>{{params.buyerName}}</strong> souhaite que vous lui transfériez le bien « {{params.propertyTitle}} ».")}
${ctaButton("Voir le tableau de bord", "{{params.dashboardUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "PROPERTY_TRANSFER_CONFIRMATION",
    name: "[White-Label] Confirmation de transfert de propriété",
    subject: "Transfert confirmé — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${paragraph("Le bien « <strong>{{params.propertyTitle}}</strong> » a été transféré de {{params.transferorName}} à {{params.transfereeName}}.")}
${ctaButton("Voir le bien", "{{params.propertyLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "PROPERTY_CREATED_CONFIRMATION",
    name: "[White-Label] Confirmation de création de bien",
    subject: "Votre bien est en ligne — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.ownerName}}")}
${paragraph("Votre bien « <strong>{{params.propertyTitle}}</strong> » ({{params.propertyType}}) a bien été créé sur {{params.appName}}.")}
${ctaButton("Gérer mon bien", "{{params.managementUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "PERSONAL_INFORMATION_MAIL",
    name: "[White-Label] Vos informations personnelles",
    subject: "Vos informations personnelles — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.firstName}}")}
${paragraph("Voici un récapitulatif de vos informations personnelles enregistrées sur {{params.appName}} :")}
${infoBox(`<p style="margin:0;"><strong>Nom complet :</strong> {{params.firstName}} {{params.lastName}}</p>
<p style="margin:0;"><strong>Identifiant :</strong> {{params.username}}</p>
<p style="margin:0;"><strong>Email :</strong> {{params.email}}</p>
<p style="margin:0;"><strong>Téléphone :</strong> {{params.mobileNo}}</p>
<p style="margin:0;"><strong>Adresse :</strong> {{params.fullAddress}}</p>`)}
          </td>
        </tr>`,
  },
  {
    key: "PERSONAL_INFORMATION_PRO_MAIL",
    name: "[White-Label] Vos informations professionnelles",
    subject: "Vos informations professionnelles — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.firstName}}")}
${paragraph("Voici un récapitulatif de vos informations professionnelles enregistrées sur {{params.appName}} :")}
${infoBox(`<p style="margin:0;"><strong>Nom complet :</strong> {{params.firstName}} {{params.lastName}}</p>
<p style="margin:0;"><strong>Société :</strong> {{params.companyName}}</p>
<p style="margin:0;"><strong>Poste :</strong> {{params.companyRole}}</p>
<p style="margin:0;"><strong>Email société :</strong> {{params.companyEmail}}</p>
<p style="margin:0;"><strong>Téléphone :</strong> {{params.companyContactNumber}}</p>
<p style="margin:0;"><strong>Site web :</strong> {{params.website}}</p>
<p style="margin:0;"><strong>Adresse :</strong> {{params.fullAddress}}</p>`)}
          </td>
        </tr>`,
  },
  {
    key: "MOBILE_TEMPLATE_ID",
    name: "[White-Label] Confirmation changement d'email (mobile)",
    subject: "Confirmez votre nouvelle adresse email — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Utilisez le code ci-dessous pour confirmer votre nouvelle adresse email :")}
${otpBox("{{params.generateOtp}}")}
          </td>
        </tr>`,
  },
  {
    key: "LINK_TEMPLATE_ID",
    name: "[White-Label] Confirmation changement d'email (lien)",
    subject: "Confirmez votre nouvelle adresse email — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Cliquez sur le bouton ci-dessous pour confirmer votre nouvelle adresse email :")}
${ctaButton("Confirmer mon adresse", "{{params.confirmationUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "OTP_FOR_CHANGE_EMAIL_MOBILE",
    name: "[White-Label] Code de changement d'email (mobile)",
    subject: "Votre code de confirmation — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Voici votre code pour confirmer le changement de votre adresse email :")}
${otpBox("{{params.generateOtp}}")}
          </td>
        </tr>`,
  },
  {
    key: "INVITE_USER_FROM_ADMIN",
    name: "[White-Label] Compte créé — invitation",
    subject: "Votre compte a été créé — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre compte <strong>{{params.role}}</strong> a été créé sur {{params.appName}}. Voici vos identifiants :")}
${credentialsBox("{{params.email}}", "{{params.password}}")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "INTEREST_UPDATE_EMAIL",
    name: "[White-Label] Mise à jour de votre transaction",
    subject: "{{params.subject}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${paragraph("{{params.primaryMessage}}")}
${paragraph("{{params.mainMessage}}")}
${paragraph("{{params.secondaryMessage}}")}
${ctaButton("Voir la propriété", "{{params.propertyLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "FORGOT_PASSWORD_ADMIN",
    name: "[White-Label] Réinitialisation de mot de passe (admin)",
    subject: "Réinitialisez votre mot de passe — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :")}
${ctaButton("Réinitialiser le mot de passe", "{{params.resetUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "COLLABORATOR_ACCOUNT_CREATED",
    name: "[White-Label] Compte collaborateur créé",
    subject: "Votre compte collaborateur — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre compte collaborateur <strong>{{params.role}}</strong> a été créé sur {{params.appName}}. Voici vos identifiants :")}
${credentialsBox("{{params.email}}", "{{params.password}}")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "ADD_USER_FROM_ADMIN",
    name: "[White-Label] Compte créé par l'administrateur",
    subject: "Votre compte a été créé — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre compte <strong>{{params.role}}</strong> a été créé sur {{params.appName}}. Voici vos identifiants :")}
${credentialsBox("{{params.email}}", "{{params.password}}")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "ADD_USER_ACCOUNT_CREATED",
    name: "[White-Label] Votre compte est prêt",
    subject: "Votre compte a été créé — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.fullName}}")}
${paragraph("Votre compte <strong>{{params.role}}</strong> est prêt sur {{params.appName}}. Voici vos identifiants :")}
${credentialsBox("{{params.email}}", "{{params.password}}")}
${ctaButton("Se connecter", "{{params.loginUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "BUYER_INVITATION",
    name: "[White-Label] Un bien vous a été partagé",
    subject: "{{params.ownerName}} vous partage un bien — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${paragraph("<strong>{{params.ownerName}}</strong> vous partage le bien « {{params.propertyTitle}} » sur {{params.appName}}.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
<tr><td align="center">
<img src="{{params.propertyImage}}" alt="{{params.propertyTitle}}" style="max-width:100%;max-height:220px;border-radius:12px;border:1px solid #eef0f5;"/>
</td></tr>
</table>
${infoBox(`<p style="margin:0;"><strong>Type :</strong> {{params.propertyType}}</p>
<p style="margin:0;"><strong>Surface :</strong> {{params.surface}} m²</p>
<p style="margin:0;"><strong>Localisation :</strong> {{params.zipcode}} {{params.city}}</p>`)}
${ctaButton("Voir le bien", "{{params.inviteLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "WEEKLY_DIGEST_WITH_PROPS",
    name: "[White-Label] Résumé hebdomadaire (avec biens)",
    subject: "Votre résumé hebdomadaire {{params.appName}} — {{params.digestDate}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.userName}}")}
${paragraph("Voici votre résumé de la semaine du <strong>{{params.digestDate}}</strong>.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
<tr>
${statCard("Nouveaux biens", "{{params.statNewProperties}}", "{{params.statNewPropertiesEvol}}", "{{params.statNewPropertiesColor}}")}
${statCard("Ventes", "{{params.statTxSale}}", "{{params.statTxSaleEvol}}", "{{params.statTxSaleColor}}")}
${statCard("Locations", "{{params.statTxRent}}", "{{params.statTxRentEvol}}", "{{params.statTxRentColor}}")}
${statCard("Annuaire", "{{params.statDirectory}}", "{{params.statDirectoryEvol}}", "{{params.statDirectoryColor}}")}
</tr>
</table>
{{params.propertiesTable}}
{{params.learningSection}}
${ctaButton("Gérer mes notifications", "{{params.settingsUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "WEEKLY_DIGEST_NO_PROPS",
    name: "[White-Label] Résumé hebdomadaire (sans biens)",
    subject: "Votre résumé hebdomadaire {{params.appName}} — {{params.digestDate}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.userName}}")}
${paragraph("Voici votre résumé de la semaine du <strong>{{params.digestDate}}</strong>.")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
<tr>
${statCard("Nouveaux biens", "{{params.statNewProperties}}", "{{params.statNewPropertiesEvol}}", "{{params.statNewPropertiesColor}}")}
${statCard("Ventes", "{{params.statTxSale}}", "{{params.statTxSaleEvol}}", "{{params.statTxSaleColor}}")}
${statCard("Locations", "{{params.statTxRent}}", "{{params.statTxRentEvol}}", "{{params.statTxRentColor}}")}
${statCard("Annuaire", "{{params.statDirectory}}", "{{params.statDirectoryEvol}}", "{{params.statDirectoryColor}}")}
</tr>
</table>
{{params.learningSection}}
${ctaButton("Gérer mes notifications", "{{params.settingsUrl}}")}
          </td>
        </tr>`,
  },
  {
    key: "OWNER_DOCS_NOTIFY",
    name: "[White-Label] Documents partagés",
    subject: "Documents partagés concernant votre propriété — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.ownerName}}")}
${paragraph("<strong>{{params.buyerName}}</strong> a partagé des documents concernant votre bien « {{params.propertyTitle}} ».")}
${ctaButton("Voir les documents", "{{params.funnelLink}}")}
          </td>
        </tr>`,
  },
  {
    key: "OWNER_CONGRATS_EMAIL",
    name: "[White-Label] Félicitations !",
    subject: "Félicitations — {{params.appName}}",
    body: `
        <tr>
          <td style="padding:16px 40px 8px;">
${greeting("{{params.renterName}}")}
${paragraph("{{params.mainMessage}}")}
${paragraph("<strong>{{params.subMessage}}</strong>")}
${ctaButton("Voir le bien", "{{params.propertyLink}}")}
          </td>
        </tr>`,
  },
];

async function main() {
  if (!API_KEY) {
    console.error("BREVO_API_KEY manquante dans le .env");
    process.exit(1);
  }

  // Templates existants (idempotence)
  let existing = [];
  try {
    const res = await fetch(`${BASE_URL}/smtp/templates?limit=200&offset=0`, {
      headers: { "api-key": API_KEY, accept: "application/json" },
    });
    const d = await res.json();
    existing = d.templates || [];
  } catch (e) {
    console.warn("Impossible de lister les templates existants:", e.message);
  }

  const created = [];
  for (const t of TEMPLATES) {
    const found = existing.find((x) => x.name === t.name);
    if (found) {
      console.log(`⏭️  Déjà présent — ${found.id} | ${t.name}`);
      created.push({ key: t.key, id: found.id, name: t.name });
      continue;
    }
    try {
      const d = await api("POST", "/smtp/templates", {
        sender: SENDER,
        templateName: t.name,
        subject: t.subject,
        htmlContent: layout(t.body),
        isActive: true,
        editor: "classic",
        tag: "white-label",
      });
      console.log(`✅ Créé — ${d.id} | ${t.name}`);
      created.push({ key: t.key, id: d.id, name: t.name });
      await sleep(400);
    } catch (e) {
      console.error(`❌ Échec — ${t.name}:`, e.message);
    }
  }

  console.log("\n=== MAPPING (constants.BREVO_WHITE_LABEL) ===");
  console.log(JSON.stringify(created.reduce((acc, c) => ({ ...acc, [c.key]: c.id }), {}), null, 2));
}

main();
