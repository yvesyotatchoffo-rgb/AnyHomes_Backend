var mongoose = require("mongoose");
var Schema = mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
        type: { type: String, enum: ["TEXT", "VIDEO", "IMAGE", "DOCUMENT"], required: true },
        room_id: { type: mongoose.Types.ObjectId, ref: 'rooms' },
        sender: { type: mongoose.Types.ObjectId, ref: 'Users' },
        content: { type: String },
        media: {
            type: Array,
        },
        property_id: { type: Schema.Types.ObjectId, ref: 'properties', },
        message_type: { type: String, },
        clearedBy: [ { type: mongoose.Types.ObjectId, ref: 'Users' } ], // field to keep track of fields that have been cleared by the user
        isDeleted: { type: Boolean, default: false },
        status: { type: String, enum: ["read", "unread"], default: "unread" },

    },
    { timestamps: true }
  );

  // Performance index—accélère le $lookup unread messages par bien
  schema.index({ property_id: 1, status: 1 });

  const Messages = mongoose.model("Messages", schema);

  return Messages;
};
