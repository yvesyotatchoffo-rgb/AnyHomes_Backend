var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      propertyId: { type: Schema.Types.ObjectId, ref: "properties", index: true },
      userId: { type: Schema.Types.ObjectId, ref: "users", index: true },
      agencyName: { type: String },
      createdAt: Date,
      updatedAt: Date,
    },
    { timestamps: true }
  );

  const AgencyReveal = mongoose.model("agencyreveals", schema);
  return AgencyReveal;
};
