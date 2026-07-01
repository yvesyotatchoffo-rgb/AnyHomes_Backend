var Mongoose = require("mongoose");
var Schema = Mongoose.Schema;

/**
 * Activity log scoped to a property.
 * Records every notable interaction involving a specific property.
 */
const PROPERTY_EVENT_TYPES = [
  "profile_view",       // a user viewed the property profile
  "like",               // a user liked the property
  "unlike",             // a user unliked the property
  "follow",             // a user started following the property
  "unfollow",           // a user unfollowed the property
  "share",              // a user shared the property
  "contact_owner",      // a user sent a message / contact request to the owner
  "visit_request",      // a user requested a visit
  "offer_sent",         // a user sent a purchase or rental offer (interest)
  "offer_status_change",// funnel status changed on an interest
  "status_change",      // property status changed (active/inactive)
  "photo_added",        // owner added photos
  "description_update", // owner updated description / details
  "price_change",       // price was updated
  "service_purchase",   // owner purchased a marketplace service for this property
  "campaign_launch",    // owner launched a P2P campaign on this property
  "campaign_end",       // P2P campaign ended
  "document_add",       // owner added a document
  "qr_scan",            // QR code was scanned
  "other",
];

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      propertyId: {
        type: Schema.Types.ObjectId,
        ref: "properties",
        required: true,
        index: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        default: null,
        index: true,
      },
      type: {
        type: String,
        enum: PROPERTY_EVENT_TYPES,
        default: "other",
        index: true,
      },
      label: { type: String, default: "" },
      // Extra fields for profile_view events
      duration: { type: Number, default: null },          // seconds spent on the profile
      sectionVisited: { type: String, default: null },    // e.g. "photos", "map", "description", "attractivity", "timeline"
      phoneRevealed: { type: Boolean, default: null },    // whether the phone number was revealed
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
  );

  const PropertyActivityLog = mongoose.model("propertyActivityLog", schema);
  return PropertyActivityLog;
};
