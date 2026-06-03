var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;

module.exports = (mongoose) => {
    var schema = mongoose.Schema(
        {
            // userId: { type: Schema.Types.ObjectId, ref: "users" },
            propertyId: { type: Schema.Types.ObjectId, ref: "properties", required: true },
            // ownerId: { type: Schema.Types.ObjectId, ref: "users", required: true },
            // propertyType: {type: String, enum: ["sale", "rent"], default: ""},
            propertyType: String,
            buyerId: { type: Schema.Types.ObjectId, ref: "users",  required: true },
            buyerPrice: { type: Object, default: 0 },
            ownerPrice: { type: Number,default: 0 },
            finalPrice: { type: Number, default: 0 }, 
            interestType: {type: String, enum: ["interest sent", "offer sent"] },                //key to diff starting point of interest/funnel
            makeOfferAmount: { type: Number, default: 0 },       // key for (make an offer) amount
            makeOfferDescription: String,                   // offer description in (make an offer)
            makeOfferMovinDate: Date,                       // (make an offer) movin date
            financingReferenceScore: { type: Number, min: 0, max: 100, default: 0 },
            financingReferenceScoreSource: { type: String, enum: ["auto", "admin", "verified"], default: "auto" },
            financingProbability: { type: Number, min: 0, max: 100, default: 0 },
            renterReferenceScore: { type: Number, min: 0, max: 100, default: 0 },
            renterReferenceScoreSource: { type: String, enum: ["auto", "admin", "verified"], default: "auto" },
            renterProbability: { type: Number, min: 0, max: 100, default: 0 },
            financialScore: { type: Number, min: 0, max: 100, default: 0 },
            financialScoreSource: { type: String, enum: ["auto", "admin", "verified"], default: "auto" },
            renterScore: { type: Number, min: 0, max: 100, default: 0 },
            renterScoreSource: { type: String, enum: ["auto", "admin", "verified"], default: "auto" },
            scoreStatus: { type: String, default: "OK" },
            scoreClass: { type: String, default: "" },
            scoreLabel: { type: String, default: "" },
            renterScoreStatus: { type: String, default: "OK" },
            renterScoreClass: { type: String, default: "" },
            renterScoreLabel: { type: String, default: "" },
            scoreQuantitative: { type: Number, min: 0, max: 70, default: 0 },
            scoreQualitative: { type: Number, min: 0, max: 30, default: 0 },
            renterScoreQuantitative: { type: Number, min: 0, max: 70, default: 0 },
            renterScoreQualitative: { type: Number, min: 0, max: 30, default: 0 },
            topReasons: { type: [String], default: [] },
            renterTopReasons: { type: [String], default: [] },
            ratioFinancabilite: { type: Number, default: 0 },
            capitalFinancable: { type: Number, default: 0 },
            besoinFinancement: { type: Number, default: 0 },
            mensualiteDisponible: { type: Number, default: 0 },
            priceSource: { type: String, default: "" },
            priceReferenceProjet: { type: Number, default: 0 },
            referencePricePerSqm: { type: Number, default: 0 },
            referencePricePostalCode: { type: String, default: "" },
            surfaceUsedForReference: { type: Number, default: 0 },
            topReasons: { type: [String], default: [] },
            // makeOfferValidDate: Date,                       // (make an offer) valid date
            userVisitDate: { type: Date},
            ownerVisitDate: { type: Date},
            finalVisitDate: { type: Object},
            icon1: { type: Boolean, default: false},
            icon2: { type: Boolean, default: false},
            icon3: { type: Boolean, default: false},
            icon4: { type: Boolean, default: false},
            icon5: { type: Boolean, default: false},
            icon6: { type: Boolean, default: false},
            icon7: { type: Boolean, default: false},
            finalPresale: { type: Date},
            userPresale: { type: Date},
            ownerPresale: { type: Date},
            review: { type: Object },
            userContract: { type: Date},
            ownerContract:{ type: Date },
            finalContract:{ type: Date },
            userSigned:{ type: Boolean, default: false },
            ownerSigned:{ type: Boolean, default: false },
            userSale: { type: Date},
            ownerSale: { type: Date},
            finalSale: { type: Date},
            userConfirmation: { type: Boolean, default: false },
            ownerConfirmation: { type: Boolean, default: false },
            changeRequestNote: { type: String},
            funnelStatus: {
                type: String,
                // enum: [
                //     "interest received",
                //     "interest sent",
                //     "non binding price received",
                //     "non binding price sent",
                //     "direct message sent",
                //     "direct message received",
                //     "form received",
                //     "form sent",
                //     "awaiting owner first name to send a visit invite",
                //     "invite user for a visit",
                //     "visit invite received",
                //     "user first name must book a visit slot",
                //     "book a visit slot",
                //     "user first name has booked a visit slot",
                //     "host the visit",
                //     "visit slot booked",
                //     "host the visit",
                //     "visit the property",
                //     "the visit took place",


// //=--------------------------------------------------------------------------------





                //     "invite for a visit",
                //     "has to book a visit",
                //     "host the visit",
                //     "visit hosted",
                //     "visit review or offer",
                //     "visit review received",
                //     "submit offer",
                //     "offer received",
                //     "answer offer",
                //     "renter application received",
                //     "offer refused",
                //     "counter offer sent",
                //     "answer counter-offer",
                //     "apply for the property",
                //     "application received",
                //     "answer application",
                //     "application not accepted",
                //     "application accepted",
                //     "sign contract",
                //     "cancelled"
                // ],
                // default: "interest received"
                },
                
            documents: { type:Object },  //seller case documents
            applicationFile: { type: Object },   //renter/lender case documents /user case files
            status: { type: String, enum: ["active", "inactive"], default: "active" },
            interestStatus: { type: String, enum: ["completed", "pending", "expired"], default: "pending"}, //this nterest status
            transferDone: { type: Boolean, default: false}, // after transfer of property/rental key becomes true
            offerStatus: { type:Boolean, default: false }, // key to identify that offer has been accepted in funnel
            applicationAccepted: { type: Boolean, default: false },  //key to identiy application has been accepted
            OldOwnerData: Object,
            finalSignSlot: { type: Object},
            finalHomeInventorySlot: { type: Object },
            isDeleted: { type: Boolean, default: false },
            propertyTransferRequest: { type: Boolean, default: false },
        },
        { timestamps: true }
    );

    // Performance index—accelère le $lookup par propertyId dans le pipeline
    schema.index({ propertyId: 1 });
    schema.index({ buyerId: 1 });

    const interests = mongoose.model("interests", schema);

    return interests;
};