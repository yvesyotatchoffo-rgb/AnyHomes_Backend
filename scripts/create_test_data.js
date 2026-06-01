require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const db = require('../app/models');

const run = async () => {
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', dbConfig.url);

  const now = new Date();
  const usersData = [
    {
      email: 'test-renter1@local',
      fullName: 'Test Renter One',
      firstName: 'Test',
      lastName: 'Renter One',
      role: 'user',
      signupObjective: 'Louer',
      status: 'active',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      renterFilesAddedAt: now,
      declarativeRenterFiles: {
        postalCode: '75001',
        InvestOption: 'primary',
        BuyOption: 'alone',
        targetRooms: '2',
        targetCity: 'Paris',
        targetRent: 1400,
        birthDate: '1990-01-01',
        nationality: 'Française',
        hasResidencePermit: 'oui',
        currentHousingStatus: 'locataire',
        residenceDuration: 24,
        currentRent: 1300,
        employmentStatus: 'employed',
        contractType: 'CDI',
        contractStatus: 'active',
        jobSeniority: 36,
        incomeType: 'salary',
        monthlyIncome: 4200,
        hasGuarantor: 'non',
      },
      renterFinancingReferenceScore: 82,
      renterFinancingReferenceScoreSource: 'auto',
      renterFinancingReferenceScoreUpdatedAt: now,
      financingReferenceScore: 78,
      financingReferenceScoreSource: 'auto',
      financingReferenceScoreUpdatedAt: now,
    },
    {
      email: 'test-renter2@local',
      fullName: 'Test Renter Two',
      firstName: 'Test',
      lastName: 'Renter Two',
      role: 'user',
      signupObjective: 'Louer',
      status: 'active',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      renterFilesAddedAt: now,
      declarativeRenterFiles: {
        postalCode: '69002',
        InvestOption: 'primary',
        BuyOption: 'alone',
        targetRooms: '1',
        targetCity: 'Lyon',
        targetRent: 950,
        birthDate: '1992-06-15',
        nationality: 'Française',
        hasResidencePermit: 'oui',
        currentHousingStatus: 'locataire',
        residenceDuration: 18,
        currentRent: 900,
        employmentStatus: 'employed',
        contractType: 'CDI',
        contractStatus: 'active',
        jobSeniority: 24,
        incomeType: 'salary',
        monthlyIncome: 3200,
        hasGuarantor: 'non',
      },
      renterFinancingReferenceScore: 74,
      renterFinancingReferenceScoreSource: 'auto',
      renterFinancingReferenceScoreUpdatedAt: now,
      financingReferenceScore: 70,
      financingReferenceScoreSource: 'auto',
      financingReferenceScoreUpdatedAt: now,
    },
  ];

  const users = [];
  for (const userData of usersData) {
    const user = await db.users.findOneAndUpdate(
      { email: userData.email },
      { $set: userData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('Upserted user', user.email, user._id.toString());
    users.push(user);
  }

  const propertyData = {
    propertyTitle: 'Appartement Test',
    name: 'Test Rental Apartment',
    city: 'Paris',
    zipcode: '75002',
    country: 'France',
    type: 'apartment',
    status: 'active',
    addedBy: users[0]._id,
    price: 1600,
    propertyMonthlyCharges: 120,
    propertyType: 'rent',
    newlocation: { type: 'Point', coordinates: [2.3522, 48.8566] },
    createdAt: now,
    updatedAt: now,
  };

  const property = await db.property.findOneAndUpdate(
    { propertyTitle: propertyData.propertyTitle, city: propertyData.city },
    { $set: propertyData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('Upserted property', property._id.toString());

  const interestData = {
    propertyId: property._id,
    buyerId: users[0]._id,
    propertyType: 'rent',
    interestType: 'interest sent',
    financingReferenceScore: 82,
    financingReferenceScoreSource: 'auto',
    renterReferenceScore: 82,
    renterReferenceScoreSource: 'auto',
    renterScore: 82,
    renterScoreSource: 'auto',
    renterScoreStatus: 'OK',
    renterScoreClass: 'FORTE',
    renterScoreLabel: 'Indice confiance locative',
    scoreStatus: 'OK',
    scoreClass: 'FORTE',
    scoreLabel: 'Indice confiance locative',
    createdAt: now,
    updatedAt: now,
  };

  const interest = await db.interests.findOneAndUpdate(
    { buyerId: users[0]._id, propertyId: property._id, propertyType: 'rent' },
    { $set: interestData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('Upserted interest lead', interest._id.toString());

  await mongoose.disconnect();
  console.log('Done.');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
