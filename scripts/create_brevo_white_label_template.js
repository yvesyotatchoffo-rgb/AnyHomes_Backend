const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { BrevoClient } = require('@getbrevo/brevo');

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

async function createWhiteLabelInviteTemplate() {
  try {
    const existing = await client.transactionalEmails.getSmtpTemplates({
      limit: 50,
      offset: 0,
    });

    const existingTemplate = existing.data?.templates?.find(
      (t) => t.templateName === 'white-label-invitation'
    );

    if (existingTemplate) {
      console.log('Template already exists with ID:', existingTemplate.id);
      process.exit(0);
    }

    const result = await client.transactionalEmails.createSmtpTemplate({
      templateName: 'white-label-invitation',
      subject: '{{params.agencyName}} vous invite à rejoindre sa plateforme',
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, Helvetica, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #976DD0, #a855f7); padding: 32px 24px; text-align: center; }
    .header img { max-height: 60px; margin-bottom: 12px; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0; }
    .content { padding: 32px 24px; text-align: center; }
    .agency-logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 16px; border: 3px solid #f3edfb; }
    .agency-name { font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0 0 8px; }
    .message { font-size: 15px; color: #4a4a6a; line-height: 1.6; margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: linear-gradient(135deg, #976DD0, #a855f7); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 999px; font-size: 16px; font-weight: 600; }
    .features { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin: 32px 0; }
    .feature { background: #f8f8fb; border: 1px solid #ebe6f5; border-radius: 12px; padding: 16px; width: 140px; text-align: center; }
    .feature-icon { font-size: 28px; margin-bottom: 8px; }
    .feature-title { font-size: 13px; font-weight: 600; color: #1a1a2e; }
    .feature-desc { font-size: 11px; color: #888; margin-top: 4px; }
    .footer { text-align: center; padding: 24px; color: #999; font-size: 12px; }
    .footer a { color: #976DD0; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{params.agencyName}}</h1>
      <p>Votre agence partenaire</p>
    </div>
    <div class="content">
      <h2 class="agency-name">{{params.agencyName}} vous invite !</h2>
      <p class="message">
        {{params.agencyName}} met à votre disposition la plateforme AnyHomes pour vous accompagner dans votre projet immobilier. <br><br>
        Accédez à des outils transactionnels, un coach IA, et les services de votre agence.
      </p>
      <div class="features">
        <div class="feature">
          <div class="feature-title">📋 Outils transactionnels</div>
          <div class="feature-desc">Suivez vos transactions</div>
        </div>
        <div class="feature">
          <div class="feature-title">🤖 Coach IA</div>
          <div class="feature-desc">Conseils personnalisés</div>
        </div>
        <div class="feature">
          <div class="feature-title">🔧 Services agence</div>
          <div class="feature-desc">À la carte</div>
        </div>
      </div>
      <div class="cta">
        <a href="{{params.inviteLink}}">Créer mon compte</a>
      </div>
    </div>
    <div class="footer">
      <p>Propulsé par <a href="https://anyhomes.fr">AnyHomes</a> pour <strong>{{params.agencyName}}</strong></p>
    </div>
  </div>
</body>
</html>`,
      sender: {
        name: '{{params.agencyName}}',
        email: process.env.BREVO_AUTH_FROM_EMAIL || 'notifications@anyhomes.fr',
      },
      isActive: true,
      params: {
        agencyName: '',
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

createWhiteLabelInviteTemplate();
