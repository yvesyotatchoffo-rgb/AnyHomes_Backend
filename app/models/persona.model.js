var Mongoose = require("mongoose"),
Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      name: { type: String, required: true },
      key: { type: String, index: true },
      rank: { type: Number, default: 0, index: true },
      isActive: { type: Boolean, default: true, index: true },
      addedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
      isDeleted: { type: Boolean, default: false, index: true },
      showCTA: { type: Boolean, default: false },
      ctaTitle: { type: String, default: "" },
      ctaText: { type: String, default: "" },
      ctaButtonText: { type: String, default: "" },
      ctaButtonUrl: { type: String, default: "" },
      createdAt: Date,
      updatedAt: Date,
    },
    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const persona = mongoose.model("persona", schema);
  return persona;
};
