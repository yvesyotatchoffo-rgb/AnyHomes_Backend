/**
 * Service Stripe pour la marketplace de services
 *
 * Flux escrow :
 *  1. createPaymentIntent()  → PaymentIntent capture_method:'manual', transfert automatique vers le pro
 *  2. capturePaymentIntent() → capture réelle (après confirmation acheteur)
 *  3. refundPaymentIntent()  → remboursement acheteur (litige en sa faveur)
 *
 * Stripe Connect (Express) pour les pros :
 *  1. createConnectAccount()     → crée un compte Stripe Express pour le pro
 *  2. createOnboardingLink()     → lien d'onboarding Stripe
 *  3. getConnectAccountStatus()  → statut du compte (charges_enabled, payouts_enabled)
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY);

const COMMISSION_RATE = Number(process.env.MARKETPLACE_COMMISSION_RATE) || 0.10; // 10%
const CURRENCY = 'eur';

// ─── PaymentIntent (escrow) ───────────────────────────────────────────────────

/**
 * Crée un PaymentIntent en mode escrow (capture manuelle)
 * Le montant est bloqué sur la carte acheteur mais pas encore capturé.
 *
 * @param {Object} params
 * @param {number}  params.amountTTC       - Montant total en € (ex: 89.00)
 * @param {string}  params.stripeAccountId - Compte Stripe Connect du pro
 * @param {string}  params.orderId         - ID de la commande (metadata)
 * @param {string}  params.buyerEmail      - Email acheteur (metadata)
 * @param {string}  params.serviceTitle    - Titre du service (description)
 * @returns {Object} Stripe PaymentIntent
 */
exports.createPaymentIntent = async ({ amountTTC, stripeAccountId, orderId, buyerEmail, serviceTitle, feeAmountCents }) => {
  const amountCents = Math.round(amountTTC * 100); // Stripe travaille en centimes
  const applicationFeeAmount = Number.isFinite(feeAmountCents)
    ? Math.round(feeAmountCents)
    : Math.round(amountCents * COMMISSION_RATE);

  const paymentIntentParams = {
    amount: amountCents,
    currency: CURRENCY,
    capture_method: 'manual', // ← escrow : bloqué, pas encore capturé
    description: `Bookaro Marketplace - ${serviceTitle}`,
    metadata: {
      orderId: String(orderId),
      buyerEmail: buyerEmail || '',
    },
    payment_method_types: ['card'],
  };

  // Si le pro a un compte Stripe Connect : transfert automatique à la capture
  if (stripeAccountId) {
    paymentIntentParams.transfer_data = { destination: stripeAccountId };
    paymentIntentParams.application_fee_amount = applicationFeeAmount;
  }

  return stripe.paymentIntents.create(paymentIntentParams);
};

/**
 * Capture un PaymentIntent (libère les fonds vers le pro, déduit la commission)
 * Appelé quand l'acheteur confirme la livraison.
 *
 * @param {string} paymentIntentId
 * @returns {Object} Stripe PaymentIntent
 */
exports.capturePaymentIntent = async (paymentIntentId) => {
  return stripe.paymentIntents.capture(paymentIntentId);
};

/**
 * Annule un PaymentIntent non capturé (commande annulée avant paiement)
 *
 * @param {string} paymentIntentId
 * @returns {Object} Stripe PaymentIntent
 */
exports.cancelPaymentIntent = async (paymentIntentId) => {
  return stripe.paymentIntents.cancel(paymentIntentId);
};

/**
 * Rembourse un PaymentIntent (total ou partiel)
 * Appelé lors d'un litige résolu en faveur de l'acheteur.
 *
 * @param {string}  paymentIntentId
 * @param {number}  [amountCents]    - Si omis, remboursement total
 * @returns {Object} Stripe Refund
 */
exports.refundPaymentIntent = async (paymentIntentId, amountCents) => {
  const refundParams = { payment_intent: paymentIntentId };
  if (amountCents) refundParams.amount = amountCents;
  return stripe.refunds.create(refundParams);
};

/**
 * Récupère un PaymentIntent
 *
 * @param {string} paymentIntentId
 * @returns {Object} Stripe PaymentIntent
 */
exports.getPaymentIntent = async (paymentIntentId) => {
  return stripe.paymentIntents.retrieve(paymentIntentId);
};

// ─── Stripe Connect (pros) ────────────────────────────────────────────────────

/**
 * Crée un compte Stripe Express pour un pro
 *
 * @param {Object} pro  - { email, name }
 * @returns {Object} Stripe Account
 */
exports.createConnectAccount = async ({ email, name }) => {
  return stripe.accounts.create({
    type: 'express',
    email,
    business_profile: { name },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: {
      payouts: { schedule: { interval: 'weekly', weekly_anchor: 'monday' } },
    },
  });
};

/**
 * Génère le lien d'onboarding Stripe pour un pro
 *
 * @param {string} accountId     - Stripe Connect account ID
 * @param {string} refreshUrl    - URL si le lien expire (ex: front-end onboarding page)
 * @param {string} returnUrl     - URL après completion
 * @returns {Object} { url } - lien à envoyer au pro
 */
exports.createOnboardingLink = async (accountId, refreshUrl, returnUrl) => {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
};

/**
 * Récupère le statut du compte Stripe Connect d'un pro
 *
 * @param {string} accountId
 * @returns {Object} { chargesEnabled, payoutsEnabled, detailsSubmitted }
 */
exports.getConnectAccountStatus = async (accountId) => {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
};

// ─── Webhook ──────────────────────────────────────────────────────────────────

/**
 * Construit et vérifie l'événement Stripe depuis la requête webhook
 *
 * @param {Buffer} rawBody     - Corps brut de la requête (avant JSON.parse)
 * @param {string} signature   - Header 'stripe-signature'
 * @returns {Object} Stripe Event
 */
exports.constructWebhookEvent = (rawBody, signature) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET non configuré');
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};
