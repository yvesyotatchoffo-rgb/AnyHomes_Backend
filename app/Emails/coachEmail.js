const { sendEmail } = require("../config/brevo.config");

const dotenv = require("dotenv");
dotenv.config();

const { BACK_WEB_URL, FRONT_WEB_URL } = process.env;

/**
 * Send notification email when coach sends a spontaneous message
 * @param {Object} options - { recipientEmail, recipientName, propertyTitle, surface, city, postalCode, listingType, propertyImage, redirectUrl }
 * @returns {Promise<Object>} Result of email send operation
 */
const sendCoachNotificationEmail = async (options) => {
  try {
    const {
      recipientEmail,
      recipientName = "User",
      propertyTitle,
      surface,
      city,
      postalCode,
      listingType = "sale",
      propertyImage,
      redirectUrl,
    } = options;

    if (!recipientEmail) {
      throw new Error("Recipient email is required");
    }

    if (!redirectUrl) {
      throw new Error("Redirect URL is required");
    }

    // Format property type in French
    const typeLabel =
      listingType === "rent" || listingType === "rental"
        ? "Location"
        : "Vente";

    // Format property info
    const propertyInfo =
      `${propertyTitle}${surface ? ` • ${surface}m²` : ""}${
        postalCode || city ? ` • ${postalCode || ""} ${city || ""}` : ""
      }`.trim();

    const emailTemplate = `<!DOCTYPE html>
<html>
<head>
    <title>AnyHomes - Coach IA</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900&display=swap" rel="stylesheet">
    <style>
        @media (max-width:767px) {
            .w-100 { width: 100%; }
            .fz-18 { font-size: 18px !important; }
            .px-20 { padding-left: 20px !important; padding-right: 20px !important; }
        }
    </style>
</head>
<body style="font-family: 'Poppins', sans-serif; background:#f5f5f5; margin: 0; padding: 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;">
        <tbody>
            <tr>
                <td style="padding: 40px 20px;">
                    <table width="600px" cellpadding="0" cellspacing="0" style="margin: 0 auto; background:#FFFFFF; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);" class="w-100">
                        <!-- Header with logo -->
                        <tr>
                            <td style="padding: 30px 30px 20px; text-align: center; border-bottom: 1px solid #E2E8F0;">
                                <img src="${BACK_WEB_URL}/img/image-1728022466713-723.png" style="width: 100px; height: auto;" />
                            </td>
                        </tr>

                        <!-- Greeting -->
                        <tr>
                            <td style="padding: 30px 30px 0;">
                                <p style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0 0 10px 0;">
                                    Bonjour ${recipientName},
                                </p>
                                <p style="font-size: 14px; color: #6D6D6D; line-height: 22px; margin: 0;">
                                    Alfred, votre coach immobilier IA, vient de vous envoyer un message à propos de votre bien.
                                </p>
                            </td>
                        </tr>

                        <!-- Property Card -->
                        <tr>
                            <td style="padding: 25px 30px;">
                                <div style="background: #F8F9FA; border-radius: 8px; padding: 16px; display: flex; gap: 12px; align-items: flex-start;">
                                    <!-- Property Image -->
                                    <div style="flex-shrink: 0;">
                                        <img src="${propertyImage || BACK_WEB_URL + "/img/placeholder.png"}" 
                                             style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover;" />
                                    </div>
                                    <!-- Property Info -->
                                    <div style="flex-grow: 1; min-width: 0;">
                                        <p style="font-size: 13px; color: #976DD0; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                                            ${typeLabel}
                                        </p>
                                        <p style="font-size: 14px; font-weight: 500; color: #1a1a1a; margin: 0 0 6px 0; word-break: break-word;">
                                            ${propertyInfo}
                                        </p>
                                        <p style="font-size: 12px; color: #976DD0; margin: 0; font-weight: 500;">
                                            📍 Bien en gestion sur AnyHomes
                                        </p>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <!-- Message -->
                        <tr>
                            <td style="padding: 0 30px;">
                                <p style="font-size: 14px; color: #6D6D6D; line-height: 22px; margin: 0;">
                                    Cliquez ci-dessous pour lire son message et suivre ses recommandations.
                                </p>
                            </td>
                        </tr>

                        <!-- CTA Button -->
                        <tr>
                            <td style="padding: 25px 30px; text-align: center;">
                                <a href="${redirectUrl}" 
                                   style="display: inline-block; background: #976DD0; color: white; text-decoration: none; padding: 12px 40px; border-radius: 25px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.3s ease;">
                                    Lire le message
                                </a>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px; text-align: center; background: #F8F9FA; border-top: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
                                <p style="font-size: 12px; color: #999; margin: 0 0 8px 0; line-height: 18px;">
                                    Vous recevez cet email parce que vous êtes propriétaire ou chercheur immobilier sur AnyHomes.
                                </p>
                                <p style="font-size: 11px; color: #CCC; margin: 0;">
                                    © ${new Date().getFullYear()} AnyHomes. Tous droits réservés.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</body>
</html>`;

    const result = await sendEmail({
      module: "COACH",
      to: recipientEmail,
      subject: `Alfred vous a envoyé un message sur AnyHomes`,
      htmlContent: emailTemplate,
    });

    return result;
  } catch (error) {
    console.error("❌ Coach email error:", error?.message || error);
    return {
      success: false,
      error: error?.message || "Failed to send coach notification email",
    };
  }
};

module.exports = {
  sendCoachNotificationEmail,
};
