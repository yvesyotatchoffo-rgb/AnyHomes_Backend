var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            reason: String,
            email: String,
            user_id:{ type: Schema.Types.ObjectId, ref: "users", index: true },
            filteredData: Object,
            name: String,
            status: { type: String, default: "active" },
            isDeleted: { type: Boolean, default: false, index: true },
            lastViewedAt: { type: Date, default: null },
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

    const alerts = mongoose.model("alerts", schema);
    return alerts;
};