var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
        newPrice: { type: Number },
        oldPrice: { type: Number },
        propertyId: {type: Schema.Types.ObjectId, ref: "properties", index: true },
        propertyType: { type: String },
        type: { type: String, enum: ["newPrice", "priceChanged", "propertyType", "revenue_detail", "expenseAdded", "renovationAdded", "externalRating", "propertyMonthlyCharges", "proposal", "ownerChange", "interestStatus", "renterInterestStatus", "photosAdded", "statusChanged", "propertyCreated", "moteurimmoLeavingMarket"] },
        addedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
        revenue_detail: { type: Array },
        meta: { type: Schema.Types.Mixed },
        propertyMonthlyCharges: { type: Number },
        proposal: { type: String },
        oldOwner: { type: String },
        newOwner: { type: String },
        renter: { type: String },
        owner: { type: String },
        transferDate: { type: Date },
        funnelStatus: { type: String, enum: [ "offer accepted", "offer refused", "application refused", "application accepted"]},
        finalPrice: { type:Number },
        refusedPrice: { type: Number },
        // applicationPrice: { type: Number },
        createdAt: Date,
        updatedAt: Date,
        like: { type: Boolean, default: false},
        likeCount: { type: Number, default: 0},
      },
        { timestamps: true }
    );

    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    const timelines = mongoose.model("timelines", schema);
    return timelines;
};