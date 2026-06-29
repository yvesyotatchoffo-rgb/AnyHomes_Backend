var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            title: String,
            title_fr: String,
            banner: String,
            images: Array,
            description: "string",
            description_fr: String,
            metaTitle: String,
            metaDescription: String,
            duration: String,
            contentLike: [{ type: Schema.Types.ObjectId, ref: "users" }],
            contentDislike: [{ type: Schema.Types.ObjectId, ref: "users" }],
            viewCount: { type: Number, default: 0 },
            status: { type: String, default: "active" },
            addedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
            blogOwner: { type: Schema.Types.ObjectId, ref: "users", },
            isDeleted: { type: Boolean, default: false, index: true },
            categoryId: { type: Schema.Types.ObjectId, ref: "persona" },
            subCategoryId: { type: Schema.Types.ObjectId, ref: "trainingTopics" },
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

    const blogs = mongoose.model("blogs", schema);
    return blogs;
};