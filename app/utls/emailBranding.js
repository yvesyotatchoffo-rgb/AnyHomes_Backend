const db = require("../models");
const constants = require("./constants");

const User = db.users;

const { BACK_WEB_URL } = process.env;

const ANYHOMES_BRANDING = {
  appName: "AnyHomes",
  logoUrl: `${BACK_WEB_URL}/img/logo.png`,
  primaryColor: "#976DD0",
  buttonColor: "#976DD0",
  agencyName: "AnyHomes",
  agencyLogo: null,
};

// ── Détection du slug d'agence depuis le host ───────────────────────────────
// Miroir de la logique du frontend (isWhiteLabelHost / getHostSlug).
function getAgencySlugFromHost(host) {
  try {
    if (!host) return null;
    const hostname = host.split(":")[0];
    const parts = hostname.split(".");
    if (parts.length >= 3 && parts[0] !== "www") return parts[0];
    if (parts.length === 2 && parts[1] === "localhost" && parts[0] !== "www") return parts[0];
  } catch (e) {
    // ignore
  }
  return null;
}

// ── Résolution de l'agence ──────────────────────────────────────────────────
function resolveAgencyBySlug(slug) {
  if (!slug) return Promise.resolve(null);
  return User.findOne({ agencySlug: slug, whiteLabelActive: true, accountType: "pro" })
    .select("agencyName agencySlug agencyLogo sidebarColor buttonColor companyLogo companyName fullName")
    .lean()
    .catch(() => null);
}

function resolveAgencyByUserId(userId) {
  if (!userId) return Promise.resolve(null);
  return User.findById(userId)
    .select("whiteLabelAgencyId")
    .lean()
    .then((user) => {
      if (!user || !user.whiteLabelAgencyId) return null;
      return User.findById(user.whiteLabelAgencyId)
        .select("agencyName agencySlug agencyLogo sidebarColor buttonColor companyLogo companyName fullName")
        .lean()
        .catch(() => null);
    })
    .catch(() => null);
}

function resolveAgencyByRecipientEmail(email) {
  if (!email) return Promise.resolve(null);
  return User.findOne({ email: email.toLowerCase(), whiteLabelAgencyId: { $ne: null } })
    .select("whiteLabelAgencyId")
    .lean()
    .then((user) => {
      if (!user || !user.whiteLabelAgencyId) return null;
      return User.findById(user.whiteLabelAgencyId)
        .select("agencyName agencySlug agencyLogo sidebarColor buttonColor companyLogo companyName fullName")
        .lean()
        .catch(() => null);
    })
    .catch(() => null);
}

/**
 * Résout l'agence white-label associée à un envoi d'email.
 * Priorité :
 *   1. `whiteLabel` explicite (passé par l'appelant, ex. invitations)
 *   2. Context requête — host → slug → agence (couvre tiers + guests)
 *   3. Context requête — userId connecté → agence
 *   4. Destinataire email → user → whiteLabelAgencyId → agence (cron/socket/webhook)
 */
async function resolveAgency({ host, userId, recipientEmail, whiteLabel }) {
  if (whiteLabel) {
    if (whiteLabel.agency) return whiteLabel.agency;
    if (whiteLabel.agencyId) return resolveAgencyByUserId(whiteLabel.agencyId);
    if (whiteLabel.slug) return resolveAgencyBySlug(whiteLabel.slug);
    return null;
  }

  const slug = getAgencySlugFromHost(host);
  if (slug) {
    const agency = await resolveAgencyBySlug(slug);
    if (agency) return agency;
  }

  if (userId) {
    const agency = await resolveAgencyByUserId(userId);
    if (agency) return agency;
  }

  if (recipientEmail) {
    const agency = await resolveAgencyByRecipientEmail(recipientEmail);
    if (agency) return agency;
  }

  return null;
}

// ── Branding ────────────────────────────────────────────────────────────────
function resolveUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/")) return `${BACK_WEB_URL}${path}`;
  return `${BACK_WEB_URL}/img/${path}`;
}

function getBrandingParams(agency) {
  if (!agency) return { ...ANYHOMES_BRANDING };

  const logoPath = agency.companyLogo || agency.agencyLogo;
  const appName = agency.agencyName || agency.companyName || agency.fullName || "AnyHomes";

  return {
    appName,
    logoUrl: resolveUrl(logoPath) || ANYHOMES_BRANDING.logoUrl,
    primaryColor: agency.buttonColor || agency.sidebarColor || ANYHOMES_BRANDING.primaryColor,
    buttonColor: agency.buttonColor || ANYHOMES_BRANDING.buttonColor,
    agencyName: appName,
    agencyLogo: resolveUrl(logoPath) || null,
  };
}

// ── Template white-label ────────────────────────────────────────────────────
// Override env : BREVO_WL_<KEY> (ex: BREVO_WL_SEND_VERIFICATION_OTP).
function getWhiteLabelTemplateId(baseKey) {
  if (!baseKey) return null;
  const envKey = `BREVO_WL_${baseKey}`;
  const fromEnv = process.env[envKey];
  if (fromEnv && /^\d+$/.test(String(fromEnv))) return Number(fromEnv);
  const mapped = constants.BREVO_WHITE_LABEL && constants.BREVO_WHITE_LABEL[baseKey];
  return mapped || null;
}

/**
 * Applique le branding white-label à un envoi :
 *  - swap le templateId si un template dédié existe
 *  - injecte les params de marque (logo, couleurs, nom)
 */
function applyBranding({ baseTemplateKey, templateId, params = {}, agency }) {
  const branding = getBrandingParams(agency);

  if (agency) {
    const wlTemplateId = getWhiteLabelTemplateId(baseTemplateKey);
    if (wlTemplateId) {
      templateId = wlTemplateId;
    }
  }

  params = {
    ...params,
    appName: branding.appName,
    agencyName: branding.agencyName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    buttonColor: branding.buttonColor,
  };

  return { templateId, params };
}

module.exports = {
  getAgencySlugFromHost,
  resolveAgency,
  resolveAgencyBySlug,
  resolveAgencyByRecipientEmail,
  getBrandingParams,
  getWhiteLabelTemplateId,
  applyBranding,
};
