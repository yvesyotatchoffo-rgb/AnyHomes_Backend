/**
 * Schémas de validation pour la marketplace de services
 */
const { validate, v } = require('./validate');

const UNIT_TYPES = ['unit', 'package'];
const ORDER_DECISIONS = ['refund', 'release'];

// ─── PRO : Créer / mettre à jour un service ───────────────────────────────────

const createServiceSchema = {
  body: {
    title:       v.requiredString('Le titre', 200),
    description: v.optionalString('La description', 2000),
    summary:     v.optionalString('Le résumé', 500),
    category:    v.mongoId('La catégorie'),
    priceTTC:    v.positiveNumber('Le prix TTC'),
    quantity:    (val) => val !== undefined ? v.positiveInt('La quantité')(val) : null,
    city:        v.requiredString('La ville', 100),
    modality:    v.optionalString('La modalité', 50),
    radiusKm:    v.positiveNumber('Le rayon (km)'),
    delivery_time: v.optionalString('Le délai de livraison', 50),
  },
};

const updateServiceSchema = {
  body: {
    title:       v.optionalString('Le titre', 200),
    description: v.optionalString('La description', 2000),
    summary:     v.optionalString('Le résumé', 500),
    priceTTC:    (val) => val !== undefined ? v.positiveNumber('Le prix TTC')(val) : null,
    quantity:    (val) => val !== undefined ? v.positiveInt('La quantité')(val) : null,
    city:        v.optionalString('La ville', 100),
    modality:    v.optionalString('La modalité', 50),
    radiusKm:    (val) => val !== undefined ? v.positiveNumber('Le rayon (km)')(val) : null,
    delivery_time: v.optionalString('Le délai de livraison', 50),
  },
};

// ─── PUBLIC : Créer une commande ──────────────────────────────────────────────

const createOrderSchema = {
  body: {
    serviceId: v.mongoId('Le service'),
    quantity:  v.positiveInt('La quantité'),
    // property_id / propertyId are optional — only validate format if provided
    property_id: (val) => (!val || val === '' ? null : v.mongoId('Le bien')(val)),
    propertyId:  (val) => (!val || val === '' ? null : v.mongoId('Le bien')(val)),
  },
};

// ─── PUBLIC : Soumettre un avis ───────────────────────────────────────────────

const createReviewSchema = {
  body: {
    orderId:   v.mongoId('La commande'),
    rating:    v.rating(),
    comment:   v.optionalString('Le commentaire', 1000),
    recommend: v.boolean('La recommandation'),
  },
};

const createCancellationRequestSchema = {
  body: {
    reason: v.requiredString('Le motif de la demande', 1000),
  },
};

// ─── ADMIN : Créer une catégorie ──────────────────────────────────────────────

const createCategorySchema = {
  body: {
    name:        v.requiredString('Le nom', 100),
    description: v.optionalString('La description', 500),
    iconUrl:     v.optionalString('L\'icône URL', 300),
    order:       v.optionalPositiveInt('L\'ordre'),
  },
};

// ─── ADMIN : Résoudre un litige ───────────────────────────────────────────────

const resolveLitigationSchema = {
  body: {
    decision: v.inEnum('La décision', ORDER_DECISIONS),
  },
};

// ─── PAGINATION commune ───────────────────────────────────────────────────────

const paginationSchema = {
  query: {
    page:  v.optionalPositiveInt('La page'),
    limit: v.optionalPositiveInt('La limite'),
  },
};

// ─── Exports middleware prêts à l'emploi ─────────────────────────────────────

module.exports = {
  validateCreateService:     validate(createServiceSchema),
  validateUpdateService:     validate(updateServiceSchema),
  validateCreateOrder:           validate(createOrderSchema),
  validateCreateReview:          validate(createReviewSchema),
  validateCreateCancellationRequest: validate(createCancellationRequestSchema),
  validateCreateCategory:        validate(createCategorySchema),
  validateResolveLitigation: validate(resolveLitigationSchema),
  validatePagination:        validate(paginationSchema),
};
