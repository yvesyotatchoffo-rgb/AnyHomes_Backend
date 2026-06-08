var jwt = require("jsonwebtoken");
const unprotectedRoutes =
  require("../utls/unprotectedRoutes").unprotectedroutes;
const db = require("../models");
const Users = db.users;
const unprotectedPrefixes = [
  "/marketplace/pro-stats/",
];

module.exports = async (req, res, next) => {
  const url = req.url.split("?");
  if (unprotectedRoutes.includes(url[0])) {
    next();
    return;
  }
  if (unprotectedPrefixes.some((prefix) => url[0].startsWith(prefix))) {
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
    _id: "guest-user-000",
    id: "guest-user-000",
    fullName: "Bookaroo Guest",
    email: "guest@bookaroo.local",
    role: "guest",
    customerRole: { name: "Guest" },
    isGuest: true,
  };

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
  next();
  return;
};
