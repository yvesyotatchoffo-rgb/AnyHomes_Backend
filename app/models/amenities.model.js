var Mongoose = require("mongoose"),
Schema = Mongoose.Schema;
module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      title: String,
      title_en: { type: String, default: "" },
      image: String,
      description: "string",
      status: { type: String, default: "active" },
      categoryId:{type:Schema.Types.ObjectId,ref:"categories"},
      addedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
      isDeleted: { type: Boolean, default: false, index: true },
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

  const amenities = mongoose.model("amenities", schema);
  return amenities;
};
