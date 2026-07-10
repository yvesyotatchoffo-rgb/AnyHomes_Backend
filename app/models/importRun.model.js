var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      runRef: { type: String, unique: true, index: true },
      source: { type: String, default: 'moteurimmo', index: true },
      startDate: { type: Date },
      endDate: { type: Date },
      duration: { type: Number },
      totalCount: { type: Number, default: 0 },
      saleCount: { type: Number, default: 0 },
      rentCount: { type: Number, default: 0 },
      ignoredCount: { type: Number, default: 0 },
      status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
      error: { type: String },
      metadata: { type: Object },
    },
    { timestamps: true }
  );

  const ImportRun = mongoose.model("importruns", schema);
  return ImportRun;
};
