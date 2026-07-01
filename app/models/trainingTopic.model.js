const mongoose = require("mongoose");

const trainingTopicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Training topic name is required"],
      trim: true,
      unique: true,
    },
    persona: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "persona",
      required: [true, "Persona is required"],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Transform _id to id for API responses
trainingTopicSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id;
  delete obj._id;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("trainingTopics", trainingTopicSchema);
