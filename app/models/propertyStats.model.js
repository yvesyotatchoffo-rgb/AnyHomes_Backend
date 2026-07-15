const mongoose = require('mongoose');

/**
 * PropertyStats — counter cache for property counts
 *
 * Documents use a string _id as composite key:
 *   "total"              → total active non-deleted properties
 *   "city:{city}"        → active properties in a given city
 *   "zip:{zipcode}"      → active properties for a given zipcode
 *   "type:{propertyType}"→ active properties of a given type (sale/rent/...)
 *
 * Using $inc (atomic) keeps counts consistent under concurrent inserts/deletes.
 */
const propertyStatsSchema = new mongoose.Schema(
  {
    _id: { type: String },   // composite key (see above)
    count: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false, versionKey: false }
);

module.exports = mongoose.model('PropertyStats', propertyStatsSchema, 'property_stats');
