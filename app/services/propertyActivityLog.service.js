/**
 * Fire-and-forget activity logger scoped to a property.
 */
const db = require("../models");

/**
 * @param {string|ObjectId} propertyId
 * @param {string} type  - one of PROPERTY_EVENT_TYPES
 * @param {object} [opts]
 * @param {string|ObjectId} [opts.userId]
 * @param {string} [opts.label]
 * @param {object} [opts.metadata]
 */
const logPropertyActivity = (propertyId, type, opts = {}) => {
  if (!propertyId) return;

  const entry = {
    propertyId,
    type,
    userId: opts.userId || null,
    label: opts.label || "",
    metadata: opts.metadata || {},
  };

  db.propertyActivityLog.create(entry).catch((err) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[propertyActivityLog] Failed to write:", err.message);
    }
  });
};

module.exports = logPropertyActivity;
