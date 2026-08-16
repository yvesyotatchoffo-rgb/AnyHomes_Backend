var jwt = require("jsonwebtoken");
const unprotectedRoutes =
  require("../utls/unprotectedRoutes").unprotectedroutes;
const db = require("../models");
const Users = db.users;
const unprotectedPrefixes = [
  "/marketplace/pro-stats/",
  "/marketplace/favorite-pros",
  "/admin/referrals/", // Referral admin analytics
  "/img/",            // Static images — served publicly, no auth needed
  "/api/public/",      // Public endpoints (vitrine agence, etc.)
];

module.exports = async (req, res, next) => {
  const url = req.url.split("?");
  if (unprotectedRoutes.includes(url[0])) {
    next();
    return;
  }
  // Allow access to Bull Board UI in non-production for local debugging
  if (process.env.NODE_ENV !== 'production' && url[0].startsWith('/admin/queues')) {
    next();
    return;
  }
  if (unprotectedPrefixes.some((prefix) => url[0].startsWith(prefix))) {
    next();
    return;
  }
  // Dossier de visite : le téléchargement du PDF s'authentifie via ?token= dans getPdf.
  // Seul ce chemin est autorisé à passer sans header (l'autorisation est revalidée dans le contrôleur).
  const isVisitFolderPdf = /^\/visit-folder\/[^/]+\/pdf$/.test(url[0]);
  if (isVisitFolderPdf && req.query && req.query.token) {
    next();
    return;
  }
  const isGuestMode =
    req.headers["x-guest-mode"] === "true" ||
    req.query.guest === "true" ||
    req.headers["x-guest-mode"] === "1";

  const isChatGuestFallback =
    !req.headers.authorization &&
    req.url.split("?")[0].startsWith("/chat");

  const guestUser = {
    // Use a 24-char hex string so Mongoose cast to ObjectId succeeds
    _id: "000000000000000000000000",
    id: "000000000000000000000000",
    fullName: "Bookaroo Guest",
    email: "guest@bookaroo.local",
    role: "guest",
    customerRole: { name: "Guest" },
    isGuest: true,
  };

  // Normalize any incoming query/body/params/header values that may contain
  // the old guest placeholder string to the 24-char hex guest id so Mongoose
  // casts don't throw.
  const GUEST_PLACEHOLDER = 'guest-user-000';
  const GUEST_ID_HEX = guestUser._id;
  const normalizeValue = (v) => (v === GUEST_PLACEHOLDER ? GUEST_ID_HEX : v);
  try {
    if (req.query) {
      Object.keys(req.query).forEach(k => { req.query[k] = normalizeValue(req.query[k]); });
    }
    if (req.params) {
      Object.keys(req.params).forEach(k => { req.params[k] = normalizeValue(req.params[k]); });
    }
    if (req.body && typeof req.body === 'object') {
      Object.keys(req.body).forEach(k => { req.body[k] = normalizeValue(req.body[k]); });
    }
    if (req.headers) {
      ['loggedinuser','userid','userId','loggedInUser'].forEach(h => {
        if (req.headers[h] === GUEST_PLACEHOLDER) req.headers[h] = GUEST_ID_HEX;
      });
    }
  } catch (e) {
    // best-effort normalization; ignore failures
  }

  if (req.headers && req.headers.authorization) {
    try {
      var parts = req.headers.authorization.split(" ");
      if (parts.length == 2) {
        var scheme = parts[0],
          credentials = parts[1];

        if (/^Bearer$/i.test(scheme)) {
          token = credentials;
        }
      } else {
        if (isGuestMode || isChatGuestFallback) {
          req.identity = guestUser;
          req.isGuest = true;
          console.log(`[AUTH] guest mode request: ${req.method} ${req.originalUrl}`);
          next();
          return;
        }
        return res.status(401).json({
          success: false,
          error: { code: 401, message: "Invalid token" },
        });
      }
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      const user = await Users.findById({ _id: decodedToken.id });
      if (user.isDeleted == true) {
        return res.status(401).json({
          success: false,
          error: {
            code: 401,
            message:
              "Your account is no longer active. Please conatct to site owner.",
          },
        });
      }
      if (user) {
        req.identity = user;
      }
    } catch (err) {
      if (isGuestMode) {
        req.identity = guestUser;
        req.isGuest = true;
        next();
        return;
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 401,
          message: "Session expired. Please login again.",
        },
      });
    }
  } else if (isGuestMode || isChatGuestFallback) {
    req.identity = guestUser;
    req.isGuest = true;
  } else {
    console.log(`[AUTH] Rejected request ${req.method} ${req.originalUrl} - no Authorization header and not guest`);
    return res.status(401).json({
      success: false,
      error: {
        code: 401,
        message: "Authentication required.",
      },
    });
  }
  // Ensure any identity that still contains the old guest placeholder string
  // is normalized to the 24-char hex guest id so Mongoose casts succeed.
  try {
    if (req.identity) {
      if (req.identity._id === GUEST_PLACEHOLDER) req.identity._id = GUEST_ID_HEX;
      if (req.identity.id === GUEST_PLACEHOLDER) req.identity.id = GUEST_ID_HEX;
    }
  } catch (e) {
    // best-effort, ignore
  }

  next();
  return;
};
