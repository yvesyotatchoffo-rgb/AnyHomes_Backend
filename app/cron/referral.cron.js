const cron = require('node-cron');
const ReferralService = require('../services/referral.service');
const db = require('../models');

const ReferralPayout = db.referralPayouts;

/**
 * Validation quotidienne des commissions éligibles (pending → approved)
 * après expiration du délai de sécurité.
 */
async function validateEligibleCommissions() {
  try {
    const result = await ReferralService.approveEligibleCommissions();
    if (result.modifiedCount > 0) {
      console.log(`[ReferralCron] ${result.modifiedCount} commission(s) approuvée(s).`);
    }
  } catch (err) {
    console.error('[ReferralCron] validateEligibleCommissions error:', err);
  }
}

/**
 * Génération des payouts hebdomadaires : regroupe les commissions approuvées
 * non payées par parrain (si >= montant minimum) et crée les payouts Stripe Connect.
 */
async function generateWeeklyPayouts() {
  try {
    const payouts = await ReferralService.generatePayouts();
    if (payouts && payouts.length) {
      console.log(`[ReferralCron] ${payouts.length} payout(s) créé(s).`);
      // Lance les transferts Stripe
      for (const payout of payouts) {
        try {
          await ReferralService.transferPayout(payout._id);
        } catch (transferErr) {
          console.error(`[ReferralCron] transfer payout ${payout._id} error:`, transferErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[ReferralCron] generateWeeklyPayouts error:', err);
  }
}

/**
 * Retry des payouts failed (ex: compte Connect inactif devenu actif).
 */
async function retryFailedPayouts() {
  try {
    const failed = await ReferralPayout.find({ status: 'failed' }).limit(50).lean();
    for (const payout of failed) {
      try {
        await ReferralService.transferPayout(payout._id);
        console.log(`[ReferralCron] Payout retry OK: ${payout._id}`);
      } catch (err) {
        // reste failed
      }
    }
  } catch (err) {
    console.error('[ReferralCron] retryFailedPayouts error:', err);
  }
}

// Validation quotidienne à 02h00 (heure de Paris)
cron.schedule('0 2 * * *', validateEligibleCommissions, { timezone: 'Europe/Paris' });

// Payouts hebdomadaires le lundi à 03h00 (heure de Paris)
cron.schedule('0 3 * * 1', generateWeeklyPayouts, { timezone: 'Europe/Paris' });

// Retry des payouts échoués toutes les 6 heures
cron.schedule('0 */6 * * *', retryFailedPayouts, { timezone: 'Europe/Paris' });

module.exports = {
  validateEligibleCommissions,
  generateWeeklyPayouts,
  retryFailedPayouts,
};
