/**
 * Controller: ServiceRequest
 * - POST  /marketplace/requests        (auth)   create
 * - GET   /marketplace/requests/mine   (auth)   list current user's requests
 * - GET   /admin/marketplace/requests  (admin)  list all (filters)
 * - PATCH /admin/marketplace/requests/:id/status (admin) mark processed/pending
 */
const ServiceRequest = require('../models/ServiceRequest.model');
const ServiceCategoryFr = require('../models/ServiceCategory_fr.model');
const ServiceCategoryEn = require('../models/ServiceCategory_en.model');
const { sendEmail } = require('../../../config/brevo.config');
const mongoose = require('mongoose');

function getCategoryModel(lang) {
  return lang === 'en' ? ServiceCategoryEn : ServiceCategoryFr;
}

/**
 * POST /marketplace/requests
 * Body: { phone, categoryId, description, lang? }
 */
exports.createRequest = async (req, res) => {
  try {
    const user = req.identity;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const lang = (req.body.lang || req.query.lang || 'fr') === 'en' ? 'en' : 'fr';
    const { phone, email, categoryId, categoryName: bodyCategoryName, description } = req.body || {};

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Le numéro de téléphone est obligatoire.' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ success: false, message: 'L\'email est obligatoire.' });
    }
    const normalizedEmail = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'L\'email est invalide.' });
    }
    if (!categoryId && !bodyCategoryName) {
      return res.status(400).json({ success: false, message: 'La catégorie est obligatoire.' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'La description est obligatoire.' });
    }

    // Catégorie : si l'id ressemble à un ObjectId on lookup la catégorie en BDD ;
    // sinon on accepte un id local (slug) + categoryName fourni par le client.
    let categoryDoc = null;
    let categoryName = bodyCategoryName ? String(bodyCategoryName).trim() : '';
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      const CategoryModel = getCategoryModel(lang);
      categoryDoc = await CategoryModel.findById(categoryId).lean();
      if (categoryDoc) categoryName = categoryDoc.name;
    }
    if (!categoryName) {
      // dernier recours : on stocke l'id brut comme libellé pour ne pas perdre l'info
      categoryName = String(categoryId || '').trim();
    }
    if (!categoryName) {
      return res.status(400).json({ success: false, message: 'Catégorie invalide.' });
    }

    const request = await ServiceRequest.create({
      user: user._id,
      userEmail: user.email,
      requestEmail: normalizedEmail,
      userName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.fullName || user.email,
      phone: String(phone).trim(),
      category: categoryDoc ? categoryDoc._id : undefined,
      categoryName,
      lang,
      description: String(description).trim(),
    });

    // Notification admin (best-effort, ne bloque pas la réponse)
    const adminEmail = process.env.MARKETPLACE_ADMIN_EMAIL || process.env.BREVO_AUTH_FROM_EMAIL;
    if (adminEmail) {
      const html = `
        <h2>Nouvelle demande de service</h2>
        <p><strong>Utilisateur :</strong> ${request.userName} (${request.userEmail || 'email inconnu'})</p>
        <p><strong>Email de contact :</strong> ${request.requestEmail}</p>
        <p><strong>Téléphone :</strong> ${request.phone}</p>
        <p><strong>Catégorie :</strong> ${request.categoryName}</p>
        <p><strong>Description :</strong></p>
        <blockquote>${request.description.replace(/\n/g, '<br>')}</blockquote>
        <p><em>Reçue le ${request.createdAt.toLocaleString('fr-FR')}</em></p>
      `;
      sendEmail({
        module: 'auth',
        to: adminEmail,
        subject: `[Marketplace] Demande de service - ${request.categoryName}`,
        htmlContent: html,
      }).catch((err) => console.error('Admin email failed:', err?.message));
    }

    return res.status(201).json({ success: true, data: request });
  } catch (err) {
    console.error('createRequest error:', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /marketplace/requests/mine
 */
exports.listMyRequests = async (req, res) => {
  try {
    const user = req.identity;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const requests = await ServiceRequest.find({ user: user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/requests
 * Query: status?, page?, limit?, q? (search description), from?, to?
 */
exports.adminListRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const filter = {};
    if (req.query.status && ['pending', 'processed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.q) {
      filter.$or = [
        { description: { $regex: req.query.q, $options: 'i' } },
        { categoryName: { $regex: req.query.q, $options: 'i' } },
        { userEmail: { $regex: req.query.q, $options: 'i' } },
        { requestEmail: { $regex: req.query.q, $options: 'i' } },
        { userName: { $regex: req.query.q, $options: 'i' } },
      ];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'firstName lastName email mobileNo')
        .populate('processedBy', 'firstName lastName email'),
      ServiceRequest.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * GET /admin/marketplace/requests/:id
 */
exports.adminGetRequestDetail = async (req, res) => {
  try {
    const request = await ServiceRequest.findById(req.params.id)
      .populate('user', 'firstName lastName email mobileNo')
      .populate('processedBy', 'firstName lastName email')
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    return res.json({ success: true, data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * DELETE /admin/marketplace/requests/:id
 */
exports.adminDeleteRequest = async (req, res) => {
  try {
    const request = await ServiceRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }
    return res.json({ success: true, message: 'Demande supprimée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

/**
 * PATCH /admin/marketplace/requests/:id/status
 * Body: { status: 'pending' | 'processed', adminNote? }
 */
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};
    if (!['pending', 'processed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    const update = {
      status,
      adminNote: typeof adminNote === 'string' ? adminNote : undefined,
    };
    if (status === 'processed') {
      update.processedAt = new Date();
      update.processedBy = req.identity?._id || null;
    } else {
      update.processedAt = null;
      update.processedBy = null;
    }

    const request = await ServiceRequest.findByIdAndUpdate(id, update, { new: true });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }
    return res.json({ success: true, data: request });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
