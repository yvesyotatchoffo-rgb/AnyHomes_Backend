const dotenv = require("dotenv");
dotenv.config();
const { BrevoClient } = require('@getbrevo/brevo');
const constants = require("../utls/constants");
const { getEmailContext } = require("../utls/emailContext");
const { resolveAgency, applyBranding, getBrandingParams } = require("../utls/emailBranding");

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});

// Retrouve la clé d'un template dans constants.BREVO à partir de son id
// (pour résoudre le template white-label équivalent).
function findBrevoKey(templateId) {
  const map = (constants && constants.BREVO) || {};
  for (const [key, val] of Object.entries(map)) {
    if (val === templateId) return key;
  }
  return null;
}

// Substitution best-effort du branding sur les emails HTML statiques (sans templateId).
function applyHtmlBranding(htmlContent, branding) {
  if (!htmlContent || !branding) return htmlContent;
  let out = htmlContent;
  if (branding.logoUrl) {
    out = out.replace(/https?:\/\/[^\s"'`]+?\/img\/image-\d+-\d+\.png/g, branding.logoUrl);
  }
  if (branding.buttonColor) {
    out = out.replace(/#976DD0/gi, branding.buttonColor);
  }
  if (branding.agencyName) {
    out = out.replace(/Bookaroo Team/g, branding.agencyName);
  }
  return out;
}

// 📌 Sender configuration
const SENDERS = {
  AUTH: {
    email: process.env.BREVO_AUTH_FROM_EMAIL,
    name: process.env.BREVO_AUTH_FROM_NAME,
  },
  PAYMENT: {
    email: process.env.BREVO_PAYMENT_FROM_EMAIL,
    name: process.env.BREVO_PAYMENT_FROM_NAME,
  },
  COACH: {
    email: process.env.BREVO_COACH_FROM_EMAIL || process.env.BREVO_AUTH_FROM_EMAIL,
    name: process.env.BREVO_COACH_FROM_NAME || "Alfred - Coach Immobilier IA",
  },
};

// 📌 Normalize recipients
const normalizeRecipients = (to) => {
  if (!to) return [];

  return (Array.isArray(to) ? to : [to]).map((item) =>
    typeof item === "string" ? { email: item } : item
  );
};

// 📌 Main email function
async function sendEmail({
  module = "AUTH",
  to,
  subject,
  htmlContent,
  params = {},
  templateId,
  attachment,
  whiteLabel, // { agencyId | agency | slug } — forcer un branding white-label
}) {
  try {
    // ✅ Validate sender    
    let sender = SENDERS[module];
    console.log(sender, '=sender');
    
    if (!sender) {
      throw new Error(`Invalid email module: ${module}`);
    }

    // ✅ Normalize recipients
    const toList = normalizeRecipients(to);
    if (!toList.length) {
      throw new Error("Recipient list is empty");
    }

    // ✅ Résolution du branding white-label (contexte requête + destinataire)
    const emailCtx = getEmailContext();
    const firstRecipient = typeof toList[0] === "string" ? toList[0] : toList[0]?.email;
    const agency = await resolveAgency({
      host: emailCtx.host || null,
      userId: emailCtx.userId || null,
      recipientEmail: firstRecipient,
      whiteLabel,
    });

    if (agency) {
      const baseKey = templateId ? findBrevoKey(templateId) : null;
      const branded = applyBranding({ baseTemplateKey: baseKey, templateId, params, agency });
      templateId = branded.templateId;
      params = branded.params;

      if (!templateId && htmlContent) {
        htmlContent = applyHtmlBranding(htmlContent, getBrandingParams(agency));
      }

      // Expéditeur au nom de l'agence (module AUTH uniquement) — copie, pas de mutation
      if (module === "AUTH" && params.appName) {
        sender = { ...sender, name: params.appName };
      }

      console.log(`📧 White-label email → ${params.appName || agency.agencyName || agency.slug} (templateId=${templateId || "html"})`);
    }

    // ✅ Build payload
    const payload = {
      sender,
      to: toList,
      ...(attachment ? { attachment } : {}),
      ...(templateId
        ? { templateId, params }
        : { subject, htmlContent, ...(Object.keys(params).length && { params }) }),
    };

    // ✅ Send email
    const response = await client.transactionalEmails.sendTransacEmail(payload);

    console.log(
      `✅ Email sent [${module}] → ${toList
        .map((r) => r.email)
        .join(", ")} | MessageId: ${response?.messageId}`
    );

    return {
      success: true,
      messageId: response?.messageId,
    };
  } catch (error) {
    console.log(error, '== error');
    
    // ✅ Improved error handling
    if (error?.statusCode === 401) {
      console.error("Brevo API key is invalid");
    } else if (error?.statusCode === 400) {
      console.error("Brevo bad request:", error?.body);
    } else {
      console.error(`Email failed [${module}]:`, error?.message || error);
    }

    return {
      success: false,
      error: error?.message || "Email sending failed",
    };
  }
}

module.exports = {
  sendEmail,
  brevoEmailModules: Object.keys(SENDERS),
};
