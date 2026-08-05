const Mongoose = require("mongoose");
const Schema = Mongoose.Schema;

const valorizationItemSchema = new Schema(
  {
    label: { type: String, required: true },
    label_en: { type: String, default: "" },
    category: { type: String, default: "" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = (mongoose) => mongoose.model("valorizationitems", valorizationItemSchema);
