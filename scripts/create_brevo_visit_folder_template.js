const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

const TEMPLATE_NAME = 'visit-folder-sent';

async function createVisitFolderTemplate() {
  try {
    // Vérifie si le template existe déjà
    const existing = await client.transactionalEmails.getSmtpTemplates({
      limit: 50,
      offset: 0,
    });

    const existingTemplate = existing.data?.templates?.find(
      (t) => t.templateName === TEMPLATE_NAME
    );

    if (existingTemplate) {
      console.log('Template already exists with ID:', existingTemplate.id);
      console.log('Set constants.BREVO.VISIT_FOLDER_SENT =', existingTemplate.id);
      process.exit(0);
    }

    // Crée le template
    const result = await client.transactionalEmails.createSmtpTemplate({
      templateName: TEMPLATE_NAME,
      subject: 'Votre dossier de visite est disponible',
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, Helvetica, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #976DD0, #a855f7); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0; }
    .content { padding: 24px; }
    .property-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0 0 4px; }
    .owner-name { font-size: 14px; color: #666; margin-bottom: 20px; }
    .message { font-size: 15px; line-height: 1.6; color: #333; margin-bottom: 16px; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #976DD0, #a855f7); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 999px; font-size: 16px; font-weight: 600; }
    .footer { text-align: center; padding: 24px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Votre dossier de visite est disponible</h1>
      <p>{{params.propertyTitle}}</p>
    </div>
    <div class="content">
      <h2 class="property-title">{{params.propertyTitle}}</h2>
      <p class="owner-name">{{params.ownerName}}</p>
      <p class="message">Bonjour {{params.candidateName}},</p>
      <p class="message">
        Votre visite de {{params.propertyTitle}} a bien été confirmée. Retrouvez en pièce jointe
        le dossier de visite détaillé de ce bien, et dans votre parcours immobilier digital,
        l'historique complet de votre transaction.
      </p>
      <div class="cta">
        <a href="{{params.dashboardUrl}}">Accéder à mon parcours immo</a>
      </div>
    </div>
    <div class="footer">
      <p>AnyHomes — L'immobilier entre particuliers</p>
    </div>
  </div>
</body>
</html>`,
      sender: {
        name: process.env.BREVO_AUTH_FROM_NAME || 'AnyHomes',
        email: process.env.BREVO_AUTH_FROM_EMAIL || 'notifications@anyhomes.fr',
      },
      isActive: true,
      params: {
        ownerName: '',
        candidateName: '',
        propertyTitle: '',
        dashboardUrl: '',
      },
    });

    console.log('Template created, full response:', JSON.stringify(result, null, 2));
    const templateId = result?.id || result?.data?.id;
    console.log('Set constants.BREVO.VISIT_FOLDER_SENT =', templateId);
    process.exit(0);
  } catch (err) {
    console.error('Error creating template:', err.message);
    process.exit(1);
  }
}

createVisitFolderTemplate();
