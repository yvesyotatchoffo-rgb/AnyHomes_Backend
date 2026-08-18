var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            interestId: { type: Schema.Types.ObjectId, ref: "interests" },
            addedBy: { type: Schema.Types.ObjectId, ref: "users" },
            propertyId: { type: Schema.Types.ObjectId, ref: "properties", },
            propertyType: String,
            buyerId: { type: Schema.Types.ObjectId, ref: "users", },
            buyerPrice: { type: Object },
            ownerPrice: { type: Number },
            finalPrice: { type: Number },
            interestType: { type: String, enum: ["interest sent", "offer sent"] },     //key to diff startting point of interest/funnel
            makeOfferAmount: { type: Number },       // key for (make an offer) amount
            makeOfferDescription: String,                   // offer description in (make an offer)
            makeOfferMovinDate: Date,                       // (make an offer) movin date 
            makeOfferValidDate: Date,                       // (make an offer) valid date
            userVisitDate: { type: Date },
            ownerVisitDate: { type: Date },
            finalVisitDate: { type: Object },
            icon1: { type: Boolean, default: false },
            icon2: { type: Boolean, default: false },
            icon3: { type: Boolean, default: false },
            icon4: { type: Boolean, default: false },
            icon5: { type: Boolean, default: false },
            icon6: { type: Boolean, default: false },
            icon7: { type: Boolean, default: false },
            finalPresale: { type: Date },
            userPresale: { type: Date },
            ownerPresale: { type: Date },
            review: { type: Object },
            userContract: { type: Date },
            ownerContract: { type: Date },
            finalContract: { type: Date },
            userSigned: { type: Boolean, default: false },
            ownerSigned: { type: Boolean, default: false },
            userSale: { type: Date },
            ownerSale: { type: Date },
            finalSale: { type: Date },
            userConfirmation: { type: Boolean, default: false },
            ownerConfirmation: { type: Boolean, default: false },
            changeRequestNote: { type: String },
            funnelStatus: { type: String },
            documents: { type: Object, },
            applicationFile: { type: Object, },
            visitFolder: { type: Object, },
            status: { type: String, enum: ["active", "inactive"], default: "active" },
            interestStatus: { type: String, enum: ["completed", "pending", "expired"], default: "pending" }, //this nterest status
            transferDone: { type: Boolean, default: false }, // after transfer of property/rental key becomes true
            offerStatus: { type: Boolean, default: false }, // key to identify that offer has been accepted in funnel
            applicationAccepted: { type: Boolean, default: false },  //key to identiy application has been accepted
            OldOwnerData: Object,
            finalSignSlot: { type: Object },
            finalHomeInventorySlot: { type: Object },
            isDeleted: { type: Boolean, default: false },
        },
        { timestamps: true }
    );

    const interestTransactions = mongoose.model("interestTransactions", schema);

    return interestTransactions;
};