module.exports = (mongoose) => {
  const schema = mongoose.Schema({
    agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, unique: true },
    visitsPerDay: { type: Number, default: 2 },
    daysSinceListed: { type: Number, default: 90 },
    visitsIn3Weeks: { type: Number, default: 2 },
    offersIn1Month: { type: Number, default: 1 },
    postVisitRating: { type: Number, default: 3 },
  }, { timestamps: true });

  return mongoose.model('agency_hot_lead_thresholds', schema);
};