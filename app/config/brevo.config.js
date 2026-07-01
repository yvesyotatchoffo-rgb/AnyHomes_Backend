const dotenv = require("dotenv");
dotenv.config();
const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
});

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
}) {
  try {
    // ✅ Validate sender    
    const sender = SENDERS[module];
    console.log(sender, '=sender');
    
    if (!sender) {
      throw new Error(`Invalid email module: ${module}`);
    }

    // ✅ Normalize recipients
    const toList = normalizeRecipients(to);
    if (!toList.length) {
      throw new Error("Recipient list is empty");
    }

    // ✅ Build payload
    const payload = {
      sender,
      to: toList,
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
