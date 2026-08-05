const db = require('../models');
const mongoose = require('mongoose');
const { sendEmail } = require('../config/brevo.config');
const BREVO_TEMPLATES = require('../utls/constants').BREVO;

const User = db.users;
const AgencyMember = db.agencyMember;
const AgencyHotLeadThreshold = db.agencyHotLeadThreshold;
const Property = db.property;
const Interest = db.interests;
const Review = db.reviews;

const getAgencyId = (req) => {
  const id = req.identity?.id || req.body.userId || req.query.userId;
  return id;
};

const isAdmin = async (agencyId, userId) => {
  const member = await AgencyMember.findOne({ agencyId, userId, role: 'admin' });
  return !!member;
};

// ── Activer la marque blanche ──────────────────────────────────────────────
exports.activate = async (req, res) => {
  try {
    const userId = getAgencyId(req);
    const user = await User.findById(userId);
    if (!user || user.accountType !== 'pro') {
      return res.status(403).json({ success: false, message: 'Seuls les pros peuvent activer la marque blanche' });
    }

    user.whiteLabelActive = true;
    if (!user.agencySlug) {
      user.agencySlug = (user.agencyName || user.fullName || 'agence').toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    }
    if (!user.agencyName) user.agencyName = user.fullName || user.companyName || 'Mon agence';
    await user.save();

    // Créer le membre admin
    await AgencyMember.findOneAndUpdate(
      { agencyId: userId, userId },
      { agencyId: userId, userId, role: 'admin', status: 'active' },
      { upsert: true, new: true }
    );

    // Créer les seuils hot leads par défaut
    await AgencyHotLeadThreshold.findOneAndUpdate(
      { agencyId: userId },
      { agencyId: userId },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('WhiteLabel.activate error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Dashboard KPIs ─────────────────────────────────────────────────────────
exports.dashboard = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const member = await AgencyMember.findOne({ agencyId, userId: agencyId });
    if (!member) return res.status(403).json({ success: false, message: 'Accès refusé' });

    const [totalUsers, totalProperties, activeTransactions, transactionsByStage, thresholds] = await Promise.all([
      User.countDocuments({ whiteLabelAgencyId: agencyId }),
      Property.countDocuments({ agencyId }),
      Interest.countDocuments({ agencyId, funnelStatus: { $nin: ['cancelled', 'lost'] } }),
      Interest.aggregate([
        { $match: { agencyId: new mongoose.Types.ObjectId(agencyId) } },
        { $group: { _id: '$funnelStatus', count: { $sum: 1 } } }
      ]),
      AgencyHotLeadThreshold.findOne({ agencyId }).lean(),
    ]);

    const threshold = thresholds || { visitsPerDay: 2, daysSinceListed: 90, visitsIn3Weeks: 2, offersIn1Month: 1, postVisitRating: 3 };
    const hotLeads = await Property.countDocuments({
      agencyId,
      $or: [
        { createdAt: { $lt: new Date(Date.now() - threshold.daysSinceListed * 24 * 60 * 60 * 1000) } },
      ]
    });

    const stageMap = {};
    transactionsByStage.forEach(s => { stageMap[s._id] = s.count; });

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalProperties,
        activeTransactions,
        transactionsByStage: stageMap,
        hotLeads,
      }
    });
  } catch (err) {
    console.error('WhiteLabel.dashboard error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Configuration agence ────────────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const user = await User.findById(agencyId).select('agencyName agencySlug agencyLogo sidebarColor buttonColor whiteLabelActive whiteLabelMaxLeads companyLogo companyName fullName');
    const thresholds = await AgencyHotLeadThreshold.findOne({ agencyId }).lean();
    return res.status(200).json({ success: true, data: { ...user.toObject(), thresholds } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    if (!(await isAdmin(agencyId, agencyId))) {
      return res.status(403).json({ success: false, message: 'Seul l\'admin peut modifier les paramètres' });
    }

    const { agencyName, agencySlug, agencyLogo, sidebarColor, buttonColor, whiteLabelMaxLeads } = req.body;
    const updates = {};
    if (agencyName !== undefined) updates.agencyName = agencyName;
    if (agencySlug !== undefined) updates.agencySlug = agencySlug;
    if (agencyLogo !== undefined) updates.agencyLogo = agencyLogo;
    if (sidebarColor !== undefined) updates.sidebarColor = sidebarColor;
    if (buttonColor !== undefined) updates.buttonColor = buttonColor;
    if (whiteLabelMaxLeads !== undefined) updates.whiteLabelMaxLeads = whiteLabelMaxLeads;

    const user = await User.findByIdAndUpdate(agencyId, updates, { new: true });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateThresholds = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    if (!(await isAdmin(agencyId, agencyId))) {
      return res.status(403).json({ success: false, message: 'Seul l\'admin peut modifier les seuils' });
    }

    const { visitsPerDay, daysSinceListed, visitsIn3Weeks, offersIn1Month, postVisitRating } = req.body;
    const threshold = await AgencyHotLeadThreshold.findOneAndUpdate(
      { agencyId },
      {
        ...(visitsPerDay !== undefined && { visitsPerDay }),
        ...(daysSinceListed !== undefined && { daysSinceListed }),
        ...(visitsIn3Weeks !== undefined && { visitsIn3Weeks }),
        ...(offersIn1Month !== undefined && { offersIn1Month }),
        ...(postVisitRating !== undefined && { postVisitRating }),
      },
      { upsert: true, new: true }
    );
    return res.status(200).json({ success: true, data: threshold });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Leads ───────────────────────────────────────────────────────────────────
exports.getLeads = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const leads = await User.find({ whiteLabelAgencyId: agencyId })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Enrichir avec le nombre de biens par lead
    const enriched = await Promise.all(leads.map(async (lead) => {
      const propertiesCount = await Property.countDocuments({ addedBy: lead._id });
      return { ...lead, propertiesCount };
    }));

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.inviteLead = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const agency = await User.findById(agencyId);
    if (!agency?.whiteLabelActive) {
      return res.status(400).json({ success: false, message: 'Marque blanche inactive' });
    }

    const frontUrl = process.env.FRONT_WEB_URL || 'http://localhost:8089';
    const inviteLink = `${frontUrl}/register?agency=${agency.agencySlug}`;

    await sendEmail({
      module: 'AUTH',
      to: email,
      templateId: BREVO_TEMPLATES.WHITE_LABEL_INVITATION,
      whiteLabel: { agencyId: agency._id },
      params: {
        agencyName: agency.agencyName || agency.fullName || 'Votre agence',
        inviteLink,
      },
    });

    return res.status(200).json({ success: true, message: 'Invitation envoyée' });
  } catch (err) {
    console.error('WhiteLabel.inviteLead error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Biens des leads ─────────────────────────────────────────────────────────
exports.getProperties = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const leads = await User.find({ whiteLabelAgencyId: agencyId }).select('_id').lean();
    const leadIds = leads.map(l => l._id);

    const properties = await Property.find({ addedBy: { $in: leadIds } })
      .populate('addedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: properties });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Hot leads ───────────────────────────────────────────────────────────────
exports.getHotLeads = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const leads = await User.find({ whiteLabelAgencyId: agencyId }).select('_id').lean();
    const leadIds = leads.map(l => l._id);

    const thresholds = await AgencyHotLeadThreshold.findOne({ agencyId }).lean();
    const t = thresholds || { visitsPerDay: 2, daysSinceListed: 90, visitsIn3Weeks: 2, offersIn1Month: 1, postVisitRating: 3 };

    const sinceDate = new Date(Date.now() - t.daysSinceListed * 24 * 60 * 60 * 1000);

    const properties = await Property.find({
      addedBy: { $in: leadIds },
      $or: [
        { createdAt: { $lt: sinceDate } },
      ]
    })
      .populate('addedBy', 'firstName lastName email mobileNo')
      .sort({ createdAt: -1 })
      .lean();

    // Enrichir avec le nombre de visites et d'offres
    const enriched = await Promise.all(properties.map(async (prop) => {
      const interestsCount = await Interest.countDocuments({ propertyId: prop._id });
      const reviews = await Review.find({ propertyId: prop._id }).lean();
      const avgRating = reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0;

      let isHot = false;
      const reasons = [];
      if (interestsCount < t.offersIn1Month) { isHot = true; reasons.push('Peu d\'intérêt'); }
      if (avgRating > 0 && avgRating < t.postVisitRating) { isHot = true; reasons.push('Note post-visite faible'); }

      return { ...prop, isHot, hotReasons: reasons, interestsCount, avgRating };
    }));

    return res.status(200).json({ success: true, data: enriched.filter(p => p.isHot) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Collaborateurs ──────────────────────────────────────────────────────────
exports.getCollaborators = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    const members = await AgencyMember.find({ agencyId })
      .populate('userId', 'firstName lastName email image status')
      .lean();

    return res.status(200).json({ success: true, data: members });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.inviteCollaborator = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    if (!(await isAdmin(agencyId, agencyId))) {
      return res.status(403).json({ success: false, message: 'Seul l\'admin peut inviter des collaborateurs' });
    }

    const { email, permissions } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email requis' });

    const agency = await User.findById(agencyId);
    const frontUrl = process.env.FRONT_WEB_URL || 'http://localhost:8089';
    const inviteLink = `${frontUrl}/register?agency=${agency?.agencySlug}&collab=true`;

    // Si un user existe déjà avec cet email, créer le membre en pending
    const tempUser = await User.findOne({ email }).lean();
    if (tempUser) {
      await AgencyMember.findOneAndUpdate(
        { agencyId, userId: tempUser._id },
        {
          agencyId,
          userId: tempUser._id,
          role: 'collaborator',
          invitedBy: new mongoose.Types.ObjectId(agencyId),
          status: 'pending',
          permissions: permissions || ['view_dashboard', 'view_leads', 'view_properties', 'view_hot_leads', 'invite_lead', 'invite_collaborator'],
        },
        { upsert: true, new: true }
      );
    }

    await sendEmail({
      module: 'AUTH',
      to: email,
      templateId: BREVO_TEMPLATES.WHITE_LABEL_INVITATION,
      whiteLabel: { agencyId: agency?._id },
      params: {
        agencyName: agency?.agencyName || agency?.fullName || 'Votre agence',
        inviteLink,
      },
    });

    return res.status(200).json({ success: true, message: 'Invitation envoyée' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCollaboratorPermissions = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    if (!(await isAdmin(agencyId, agencyId))) {
      return res.status(403).json({ success: false, message: 'Seul l\'admin peut modifier les droits' });
    }

    const { memberId, permissions } = req.body;
    if (!memberId || !permissions) {
      return res.status(400).json({ success: false, message: 'memberId et permissions requis' });
    }

    const member = await AgencyMember.findOneAndUpdate(
      { _id: memberId, agencyId, role: 'collaborator' },
      { permissions },
      { new: true }
    ).populate('userId', 'firstName lastName email image status');

    if (!member) return res.status(404).json({ success: false, message: 'Membre introuvable' });

    return res.status(200).json({ success: true, data: member });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin : activation manuelle du white-label ─────────────────────────────
exports.adminToggle = async (req, res) => {
  try {
    const { userId, active } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId requis' });

    const user = await User.findByIdAndUpdate(
      userId,
      { whiteLabelActive: active === true || active === 'true' },
      { new: true }
    ).select('_id whiteLabelActive agencyName fullName');

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCollaborator = async (req, res) => {
  try {
    const agencyId = getAgencyId(req);
    if (!(await isAdmin(agencyId, agencyId))) {
      return res.status(403).json({ success: false, message: 'Seul l\'admin peut supprimer des collaborateurs' });
    }

    const { id } = req.params;
    await AgencyMember.findOneAndDelete({ _id: id, agencyId, role: { $ne: 'admin' } });
    return res.status(200).json({ success: true, message: 'Collaborateur supprimé' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
