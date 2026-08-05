const db = require('../models');
const mongoose = require('mongoose');

const User = db.users;

exports.checkSlug = async (req, res) => {
  try {
    const { slug, excludeId } = req.query;
    if (!slug) return res.status(400).json({ success: false, message: 'Slug requis' });

    const query = { agencySlug: slug, whiteLabelActive: true };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }
    const existing = await User.findOne(query).select('_id').lean();
    return res.status(200).json({ success: true, exists: !!existing });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAgencyBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const agency = await User.findOne({
      agencySlug: slug,
      whiteLabelActive: true,
      accountType: 'pro',
    }).select('agencyName agencySlug agencyLogo sidebarColor buttonColor about companyName fullName email mobileNo website address city coverImage companyLogo');

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agence non trouvée' });
    }

    return res.status(200).json({ success: true, data: agency });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
