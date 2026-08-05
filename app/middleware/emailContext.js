const { runWithEmailContext } = require("../utls/emailContext");

/**
 * Middleware global : stocke le contexte white-label de la requête
 * (host + utilisateur connecté) pour que tout email envoyé pendant la
 * requête puisse être marqué au nom de l'agence vitrine.
 */
module.exports = (req, res, next) => {
  const ctx = {
    host: req.headers.host || null,
    userId: req.identity?.id || req.identity?._id || req.body?.userId || req.query?.userId || null,
  };
  runWithEmailContext(ctx, next);
};
