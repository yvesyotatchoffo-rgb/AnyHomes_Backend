var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;
module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      addedBy: { type: Schema.Types.ObjectId, ref: "users" },
      status: { type: String, default: "active" },
      debtRatio: { type: Number, default: 0.35 },
      loanDurationYears: { type: Number, default: 25 },
      nominalAnnualRate: { type: Number, default: 0.035 },
      insuranceAnnualRate: { type: Number, default: 0.01 },
      grossToNetCoefficient: { type: Number, default: 0.75 },
      variableIncomeRetention: { type: Number, default: 0.7 },
      additionalIncomeRetention: { type: Number, default: 0.7 },
      feesRate: {
        ancien: { type: Number, default: 0.08 },
        neuf: { type: Number, default: 0.03 },
        venteSurPlan: { type: Number, default: 0.03 },
        construction: { type: Number, default: 0.1 },
        terrainConstruction: { type: Number, default: 0.1 },
      },
      scoreBuckets: [
        {
          min: { type: Number, default: 1.1 },
          score: { type: Number, default: 70 },
        },
      ],
    },
    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const ScoreParameters = mongoose.model("scoreParameters", schema);
  return ScoreParameters;
};
