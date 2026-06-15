module.exports = (mongoose) => {
  const schema = new mongoose.Schema(
    {
      jobId: { type: String, index: true },
      queueName: { type: String },
      status: { type: String, enum: ['waiting', 'active', 'completed', 'failed'], default: 'waiting' },
      progress: { type: Object },
      attemptsMade: { type: Number },
      params: { type: Object },
      result: { type: Object },
      error: { type: Object },
    },
    { timestamps: true }
  );

  return mongoose.model('importJobs', schema);
};
