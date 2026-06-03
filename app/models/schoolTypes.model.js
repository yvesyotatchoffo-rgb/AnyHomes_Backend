var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
  );

  const schoolTypes = mongoose.model("schoolTypes", schema);
  return schoolTypes;
};
