const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

async function createInviteTemplate() {
  try {
    // Check if template already exists
    const existing = await client.transactionalEmails.getSmtpTemplates({
      limit: 50,
      offset: 0,
    });

    const existingTemplate = existing.data?.templates?.find(
      (t) => t.templateName === 'buyer-invitation'
    );

    if (existingTemplate) {
    console.log('Template already exists with ID:', existingTemplate.id);
    process.exit(0);
  }

  // Create the template
  const result = await client.transactionalEmails.createSmtpTemplate({
      templateName: 'buyer-invitation',
      subject: '{{params.ownerName}} vous invite à découvrir son bien {{params.propertyTitle}}',
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
    .property-image { width: 100%; height: 220px; object-fit: cover; border-radius: 12px; margin-bottom: 16px; }
    .property-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0 0 4px; }
    .property-type { display: inline-block; background: #f3edfb; color: #976DD0; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
    .details { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .detail-badge { background: #f8f8fb; border: 1px solid #ebe6f5; border-radius: 999px; padding: 6px 14px; font-size: 13px; color: #4a4a6a; }
    .owner-name { font-size: 14px; color: #666; margin-bottom: 20px; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #976DD0, #a855f7); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 999px; font-size: 16px; font-weight: 600; }
    .footer { text-align: center; padding: 24px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Invitation à découvrir un bien</h1>
      <p>{{params.ownerName}} souhaite vous faire découvrir son bien</p>
    </div>
    <div class="content">
      <img src="{{params.propertyImage}}" alt="{{params.propertyTitle}}" class="property-image" />
      <h2 class="property-title">{{params.propertyTitle}}</h2>
      <span class="property-type">{{params.propertyType}}</span>
      <div class="details">
        <span class="detail-badge">{{params.surface}} m²</span>
        <span class="detail-badge">{{params.zipcode}} {{params.city}}</span>
      </div>
      <p class="owner-name">{{params.ownerName}} vous invite à découvrir ce bien et à poursuivre la transaction dans l'outil transactionnel AnyHomes.</p>
      <div class="cta">
        <a href="{{params.inviteLink}}">Voir le bien</a>
      </div>
    </div>
    <div class="footer">
      <p>AnyHomes — L'immobilier entre particuliers</p>
    </div>
  </div>
</body>
</html>`,
      sender: {
        name: 'AnyHomes',
        email: process.env.BREVO_AUTH_FROM_EMAIL || 'notifications@anyhomes.fr',
      },
      isActive: true,
      params: {
        propertyImage: '',
        propertyTitle: '',
        propertyType: '',
        surface: '',
        zipcode: '',
        city: '',
        ownerName: '',
        inviteLink: '',
      },
    });

    console.log('Template created, full response:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error creating template:', err.message);
    process.exit(1);
  }
}

createInviteTemplate();
