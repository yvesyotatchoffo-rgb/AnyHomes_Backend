var Mongoose = require("mongoose");
var Schema = Mongoose.Schema;

// Exhaustive list of event types tracked across the platform.
const EVENT_TYPES = [
  "login",
  "logout",
  "password_change",
  "profile_update",
  "property_view",
  "property_like",
  "property_follow",
  "property_create",
  "property_update",
  "offer_sent",           // interest / lead sent on a property
  "campaign_launch",      // P2P estimation campaign started
  "folder_create",        // seller / buyer / tenant dossier created
  "document_add",         // file added to a folder
  "questionnaire_buyer",  // declarativeBuyerFiles updated
  "questionnaire_renter", // declarativeRenterFiles updated
  "search_saved",         // search saved by user
  "other",
];

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
      type: { type: String, enum: EVENT_TYPES, default: "other", index: true },
      label: { type: String, default: "" },
      objectType: {
        type: String,
        enum: ["property", "campaign", "interest", "folder", "search", "user", "other", ""],
        default: "",
      },
      objectId: { type: Schema.Types.ObjectId, default: null },
      objectTitle: { type: String, default: "" }, // snapshot of the object label at log time
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
  );

  const ActivityLog = mongoose.model("activityLog", schema);
  return ActivityLog;
};
