/**
 * Stripe Webhook Handler — Services Marketplace
 *
 * IMPORTANT : cette route doit recevoir le corps RAW (Buffer),
 * pas le body parsé JSON. Voir app/routes/index.js pour le montage
 * avec express.raw({ type: 'application/json' }).
 */

const stripeService = require('../services/stripeMarketplaceService');
const ServiceOrderEn = require('../models/ServiceOrder_en.model');
const ServiceOrderFr = require('../models/ServiceOrder_fr.model');
const db = require('../../../models');
const { sendEmail } = require('../../../config/brevo.config');
const constants = require('../../../utls/constants');
const { formatDisplayName } = require('../../../utls/formatDisplayName');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Trouve une commande par stripePaymentIntentId, toutes langues confondues.
 */
async function findOrderByPaymentIntentId(paymentIntentId) {
  let order = await ServiceOrderEn.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!order) order = await ServiceOrderFr.findOne({ stripePaymentIntentId: paymentIntentId });
  return order;
}

// ── Handler principal ─────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  // Vérifier la signature Stripe
  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('[StripeWebhook] Signature invalide :', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[StripeWebhook] Event reçu : ${event.type} | ${event.id}`);

  try {
    switch (event.type) {
      // ── Paiement finalisé par le client (checkout complété) ───────────────
      case 'payment_intent.amount_capturable_updated': {
        // Le PaymentIntent est authorized (client a payé, capture en attente)
        const pi = event.data.object;
        const order = await findOrderByPaymentIntentId(pi.id);
        if (order && order.status === 'pending_payment') {
          order.status = 'paid';
          order.paidAt = new Date();
          await order.save();
          console.log(`[StripeWebhook] Commande ${order._id} → paid (PaymentIntent authorized)`);
          // Email de confirmation commande payée → acheteur
          try {
            const buyerUser = await db.users.findById(order.buyer).select('email fullName firstName lastName username accountType').lean();
            if (buyerUser?.email) {
              await sendEmail({
                to: [{ email: buyerUser.email, name: buyerUser.fullName || buyerUser.firstName || '' }],
                templateId: constants.BREVO.SERVICE_ORDER_CONFIRMATION,
                params: {
                  buyerName: formatDisplayName(buyerUser),
                  serviceTitle: order.serviceSnapshot?.title || order.serviceSnapshot?.title_fr || '',
                  quantity: order.quantity,
                  totalPriceTTC: order.totalPriceTTC,
                  proName: formatDisplayName(order.proSnapshot),
                  orderId: String(order._id),
                },
              });
            }
          } catch (emailErr) {
            console.error('[Email] SERVICE_ORDER_CONFIRMATION (webhook):', emailErr.message);
          }
        }
        break;
      }

      // ── Capture réussie → fonds envoyés au pro ────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const order = await findOrderByPaymentIntentId(pi.id);
        if (order) {
          if (order.status !== 'confirmed_by_buyer' && order.status !== 'payout_released') {
            order.status = 'confirmed_by_buyer';
          }
          order.payoutStatus = 'released';
          if (!order.payoutReleasedAt) order.payoutReleasedAt = new Date();
          await order.save();
          console.log(`[StripeWebhook] Commande ${order._id} → payoutStatus = released`);
        }
        break;
      }

      // ── Échec de paiement ─────────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const order = await findOrderByPaymentIntentId(pi.id);
        if (order && order.status === 'pending_payment') {
          order.status = 'payment_failed';
          await order.save();
          console.warn(`[StripeWebhook] Commande ${order._id} → payment_failed`);
        }
        break;
      }

      // ── Remboursement effectué ────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object;
        const pi = charge.payment_intent;
        if (pi) {
          const order = await findOrderByPaymentIntentId(pi);
          if (order) {
            order.status = 'refunded';
            order.payoutStatus = 'cancelled';
            if (!order.refundedAt) order.refundedAt = new Date();
            await order.save();
            console.log(`[StripeWebhook] Commande ${order._id} → refunded`);
          }
        }
        break;
      }

      // ── Mise à jour du compte Connect (pro a complété l'onboarding) ───────
      case 'account.updated': {
        const account = event.data.object;
        if (account.charges_enabled && account.payouts_enabled) {
          const User = require('../../../../models/users.model');
          const user = await User.findOne({ stripeConnectAccountId: account.id });
          if (user) {
            user.stripeConnectActive = true;
            await user.save();
            console.log(`[StripeWebhook] Pro ${user._id} → stripeConnectActive = true`);
          }
        }
        break;
      }

      default:
        // Events non gérés — on les accepte silencieusement pour éviter les retries Stripe
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[StripeWebhook] Erreur de traitement :', err.message);
    // On retourne 200 même en cas d'erreur interne pour éviter les retries Stripe
    // et logger l'erreur pour investigation
    return res.status(200).json({ received: true, warning: 'Internal processing error logged' });
  }
};
