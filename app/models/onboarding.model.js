const mongoose = require('mongoose');

module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;
  const schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'users', required: true, unique: true },
    profile: { type: String, enum: ['owner','searcher','buyer','professional'], default: 'owner' },
    objective: { type: String, default: 'sell' },
    completions: { type: Object, default: {} },
    configuredAt: { type: Date, default: null },
  }, { timestamps: true });

  schema.method('toJSON', function() {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  return mongooseInstance.model('onboardings', schema);
};
