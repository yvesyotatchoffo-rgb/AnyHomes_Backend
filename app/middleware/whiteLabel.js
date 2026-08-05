const db = require('../models');
const User = db.users;

/**
 * Middleware qui détecte si l'utilisateur est un user white-label
 * et attache les infos de son agence à req.whiteLabel.
 */
module.exports = async (req, res, next) => {
  try {
    const userId = req.identity?.id || req.query.userId || req.body.userId;
    if (userId) {
      const user = await User.findById(userId).lean();
      if (user?.whiteLabelAgencyId) {
        const agency = await User.findById(user.whiteLabelAgencyId).select('agencyName agencySlug agencyLogo sidebarColor buttonColor').lean();
        req.whiteLabel = { user, agency };
      }
    }
  } catch (e) {
    // Non-bloquant
  }
  next();
};
