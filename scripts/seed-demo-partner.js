const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dbConfig = require('../app/config/db.config');
const db = require('../app/models');
const seedMarketplace = require('../app/modules/services-marketplace/seed/seedMarketplace');

dotenv.config();

async function run() {
  const mongoUrl = process.env.DB_URL || dbConfig.url;
  if (!mongoUrl) {
    console.error('Aucune URL MongoDB disponible. Vérifiez .env ou app/config/db.config.js');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const demoEmail = 'demo.partner@bookaro.test';
  let demoUser = await db.users.findOne({ email: demoEmail });

  if (!demoUser) {
    demoUser = await db.users.create({
      firstName: 'Claire',
      lastName: 'Durand',
      fullName: 'Claire Durand',
      companyName: 'Claire Gestion Immobilière',
      email: demoEmail,
      password: 'Password123!',
      accountType: 'pro',
      role: 'agent',
      city: 'Paris',
      pinCode: '75010',
      status: 'active',
      isGlobalFavorite: true,
      isLocalFavorite: true,
      localFavoritePostalCodes: ['75010', '75011'],
      isTopAgent: true,
      partnerAssignedAt: new Date(),
      servicesOffered: ['Conseil immobilier', 'Visites', 'Négociation'],
      image: 'https://via.placeholder.com/300',
      coverImage: 'https://via.placeholder.com/1200x400',
      featuredTitle: 'Agent Immobilier Confirmé',
      featuredBio: 'Accompagnement complet pour vos achats et ventes.',
      featuredExperienceYears: 8,
      featuredClientsAccompanied: 120,
      featuredRatingNotes: 'Excellent service',
      featuredSatisfactionRate: '98%',
      featuredProfilePhoto: 'https://via.placeholder.com/200',
    });
    console.log('Created demo partner user:', demoUser.email);
  } else {
    console.log('Demo partner already exists:', demoUser.email);
  }

  const seedResult = await seedMarketplace(demoUser._id);
  console.log('Marketplace seed result:', seedResult);

  const propertyData = [
    {
      propertyTitle: 'Appartement T2 Paris 10',
      name: 'Appartement T2 Paris 10',
      propertyType: 'sale',
      type: 'apartment',
      newlocation: { type: 'Point', coordinates: [2.3522, 48.8566] },
      city: 'Paris',
      zipcode: '75010',
      price: 420000,
      status: 'active',
      addedBy: demoUser._id,
      isDeleted: false,
      images: ['https://via.placeholder.com/640x360'],
    },
    {
      propertyTitle: 'Studio meublé à louer Lyon',
      name: 'Studio meublé à louer Lyon',
      propertyType: 'rent',
      type: 'apartment',
      newlocation: { type: 'Point', coordinates: [4.8357, 45.7640] },
      city: 'Lyon',
      zipcode: '69003',
      price: 850,
      status: 'active',
      addedBy: demoUser._id,
      isDeleted: false,
      images: ['https://via.placeholder.com/640x360'],
    },
    {
      propertyTitle: 'Annuaire Partenaire Services',
      name: 'Annuaire Partenaire Services',
      propertyType: 'directory',
      type: 'apartment',
      newlocation: { type: 'Point', coordinates: [2.3522, 48.8566] },
      city: 'Paris',
      zipcode: '75010',
      price: 0,
      status: 'active',
      addedBy: demoUser._id,
      isDeleted: false,
      images: ['https://via.placeholder.com/640x360'],
    },
  ];

  for (const prop of propertyData) {
    const existing = await db.property.findOne({ propertyTitle: prop.propertyTitle, addedBy: demoUser._id, isDeleted: false });
    if (!existing) {
      await db.property.create(prop);
      console.log('Created property:', prop.propertyTitle);
    } else {
      console.log('Property already exists:', prop.propertyTitle);
    }
  }

  await mongoose.disconnect();
  console.log('Seed completed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
