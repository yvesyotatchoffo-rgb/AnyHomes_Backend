var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;
module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      sendTo: { type: Schema.Types.ObjectId, ref: "users" },
      sendBy: { type: Schema.Types.ObjectId, ref: "users" },
      isDeleted: { type: Boolean, default: false },
      status: { type: String, enum: ["read", "unread"], default: "unread" },
      property_id: {
        type: Schema.Types.ObjectId,
        ref: 'properties',
      },
      interestId: {
        type: Schema.Types.ObjectId,
        ref: "interests",
      },
      type: { type: String },
      message: { type: String },
      title: { type: String },
      link: { type: String },
      resourceType: { type: String },
      resourceId: { type: Schema.Types.ObjectId },
      createdAt: Date,
      updatedAt: Date,
    },
    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });
  const notifications = mongoose.model("notifications", schema);
  return notifications;

};
