var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            name: String,
            type: { type: String, enum: ["State", "Revenue", "Revenue-Source", "Expense", "Ratings", "Renovation"] },
            placeholderUrl: { type: String, default: "" },
            image: String,
            revenueType: { type: Schema.Types.ObjectId, ref: "revenueManagement" },
            status: { type: String, default: "active" },
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

    const revenue = mongoose.model("revenueManagement", schema);
    return revenue;
};