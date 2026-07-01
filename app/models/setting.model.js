var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;
module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      user_id: { type: Schema.Types.ObjectId, ref: "users" },
      new_messages: { type: Object },
      property_profile: { type: Object },
      new_like: { type: Object },
      new_follow: { type: Object },
      new_share: { type: Object },
      new_share_follow: { type: Object },
      new_status_update: { type: Object },
      new_key_update: { type: Object },
      new_blog_post: { type: Object },
      new_feature_release: { type: Object },
      send_notification: { type: String },
      weeklyDigest: { type: Object, default: null },
      status: { type: String, default: "active" },
      isDeleted: { type: Boolean, default: false, index: true },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const setting = mongoose.model("setting", schema);
  return setting;
};
