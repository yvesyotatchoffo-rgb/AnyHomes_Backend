/**
 * ServiceRequest
 * Demande de service envoyée par un utilisateur depuis la marketplace
 * (lorsqu'il ne trouve pas de service correspondant à son besoin).
 */
const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

    // Snapshots pour l'admin (évite la double jointure)
    userEmail: { type: String },
    requestEmail: { type: String, trim: true },
    userName: { type: String },

    phone: { type: String, required: true, trim: true },

    // Catégorie marketplace choisie. Optionnel : si elle vient d'une liste locale
    // (Acheter / Vendre / Louer / Gérer) il n'y a pas forcément d'ObjectId.
    // Le libellé est toujours stocké via categoryName.
    category: { type: mongoose.Schema.Types.ObjectId, default: null },
    categoryName: { type: String, required: true, trim: true },
    lang: { type: String, enum: ['fr', 'en'], default: 'fr' },

    description: { type: String, required: true, trim: true, maxlength: 2000 },

    status: {
      type: String,
      enum: ['pending', 'processed'],
      default: 'pending',
      index: true,
    },
    processedAt: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users', default: null },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
