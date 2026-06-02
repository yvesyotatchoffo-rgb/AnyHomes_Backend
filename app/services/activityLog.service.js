/**
 * Lightweight fire-and-forget activity logger.
 *
 * Usage:
 *   const logActivity = require("../services/activityLog.service");
 *   logActivity(userId, "login", { ip: req.ip });
 *   logActivity(userId, "property_like", { objectId: propertyId, objectType: "property", objectTitle: property.propertyTitle });
 */

const db = require("../models");

/**
 * @param {string|ObjectId} userId
 * @param {string} type          - one of the EVENT_TYPES enum values
 * @param {object} [opts]
 * @param {string}   [opts.label]
 * @param {string}   [opts.objectType]
 * @param {string|ObjectId} [opts.objectId]
 * @param {string}   [opts.objectTitle]
 * @param {object}   [opts.metadata]
 */
const logActivity = (userId, type, opts = {}) => {
  if (!userId) return;

  const entry = {
    userId,
    type,
    label: opts.label || "",
    objectType: opts.objectType || "",
    objectId: opts.objectId || null,
    objectTitle: opts.objectTitle || "",
    metadata: opts.metadata || {},
  };

  // Fire-and-forget: do not block the request response
  db.activityLog.create(entry).catch((err) => {
    // Silently ignore logging errors to avoid disrupting main flows
    if (process.env.NODE_ENV !== "production") {
      console.warn("[activityLog] Failed to write activity:", err.message);
    }
  });
};

module.exports = logActivity;
