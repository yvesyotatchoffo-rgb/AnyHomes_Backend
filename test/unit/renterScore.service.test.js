/* Renter score unit test

Usage:
  node test/unit/renterScore.service.test.js
*/

const assert = require('assert');
const { computeRenterScore } = require('../../app/services/financialScore.service');

async function run() {
  const validPayload = {
    declarativeRenterFiles: {
      incomeType: 'mensuel_net_avant_impot',
      monthlyIncome: 3200,
      targetRent: 1100,
      nationality: 'hors_ue',
      hasResidencePermit: 'oui',
      employmentStatus: 'employe',
      contractType: 'cdi',
      contractStatus: 'hors_periode_essai',
      jobSeniority: 2,
      hasGuarantor: 'avez',
      guarantorType: 'personne_physique',
      guarantorIncomeType: 'mensuel_net_avant_impot',
      guarantorMonthlyIncome: 2600,
    },
  };

  const result = await computeRenterScore(validPayload);

  assert.strictEqual(result.mode, 'RENTER_QUESTIONNAIRE', 'Expected correct mode');
  assert.ok(typeof result.score === 'number', 'Expected numeric score');
  assert.ok(result.score >= 0 && result.score <= 100, 'Expected score between 0 and 100');
  assert.strictEqual(result.score_status, 'OK', 'Expected OK status for valid payload');
  assert.strictEqual(result.score_class, 'INTERMEDIAIRE', 'Expected intermediate score class');
  assert.ok(Array.isArray(result.top_reasons), 'Expected top_reasons array');
  assert.ok(result.top_reasons.length > 0, 'Expected at least one top reason');

  const propertySpecificResult = await computeRenterScore({
    declarativeRenterFiles: {
      incomeType: 'mensuel_net_avant_impot',
      monthlyIncome: 3200,
      targetRent: 2200,
      nationality: 'hors_ue',
      hasResidencePermit: 'oui',
      employmentStatus: 'employe',
      contractType: 'cdi',
      contractStatus: 'hors_periode_essai',
      jobSeniority: 2,
      hasGuarantor: 'avez',
      guarantorType: 'personne_physique',
      guarantorIncomeType: 'mensuel_net_avant_impot',
      guarantorMonthlyIncome: 2600,
    },
    property: {
      propertyType: 'rent',
      price: 1100,
    },
  });

  assert.strictEqual(propertySpecificResult.mode, 'RENTER_PROPERTY', 'Expected property-specific renter mode');
  assert.strictEqual(propertySpecificResult.target_rent, 1100, 'Expected property rent to override target rent');
  assert.ok(propertySpecificResult.score >= 0 && propertySpecificResult.score <= 100, 'Expected score between 0 and 100');

  const invalidPermitPayload = {
    declarativeRenterFiles: {
      incomeType: 'mensuel_net_avant_impot',
      monthlyIncome: 3200,
      targetRent: 1100,
      nationality: 'hors_ue',
      hasResidencePermit: 'non',
      employmentStatus: 'employe',
      contractType: 'cdi',
      contractStatus: 'hors_periode_essai',
      jobSeniority: 2,
      hasGuarantor: 'avez',
      guarantorType: 'personne_physique',
      guarantorIncomeType: 'mensuel_net_avant_impot',
      guarantorMonthlyIncome: 2600,
    },
  };

  const invalidResult = await computeRenterScore(invalidPermitPayload);
  assert.strictEqual(invalidResult.score, 0, 'Expected score zero for invalid residence permit');
  assert.strictEqual(invalidResult.score_status, 'INVALID_RESIDENCE_PERMIT', 'Expected invalid permit status');

  console.log('Renter score service unit test passed');
}

run().catch((err) => {
  console.error('Renter score service unit test failed');
  console.error(err);
  process.exitCode = 1;
});
