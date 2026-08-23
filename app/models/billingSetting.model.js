var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      // Taux de TVA (%) appliqué aux abonnements (plan pricing = prix TTC).
      vatPercent: { type: Number, default: 20 },
      updatedBy: { type: Schema.Types.ObjectId, ref: "users" },
    },
    { timestamps: true }
  );
  const BillingSetting = mongoose.model("billingSettings", schema);
  return BillingSetting;
};