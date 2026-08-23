module.exports = (mongooseInstance) => {
  const Schema = mongooseInstance.Schema;

  const schema = new Schema({
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 32,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    disabledReason: {
      type: String,
      trim: true,
      default: null,
    },
  }, { timestamps: true });

  return mongooseInstance.model("referralCodes", schema);
};
