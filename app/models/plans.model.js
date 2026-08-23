var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;

module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        require: false,
      },
      role: {
        type: String,
      },
      status: {
        type: String,
        enum: ["active", "deactive"],
        default: "active",
      },
      feature: [{
        type: Schema.Types.ObjectId,
        ref: "features"
      }],
      pricing: {
        type: Array,
      },
      // interval: {
      //   type: String,
      //   default: "",
      // },
      // monthlyPrice: {
      //   type: Object,
      // },
      // yearlyPrice: {
      //   type: Object,
      // },
      otherDetails: {
        type: Object,
      },
      numberOfProperty: {
        type: Number,
        // default: 0
      },
      numberOfInterest: {
        type: Number,
      },
      messageToDirectoryOwners: {            // how many messages allowed to send to directory owners
        type: Number,
      },
      messagesToOwners: {                    //message limit to normal property owners for user
        type: Number
      },
      trialPeriod: {
        type: Number,
        default: 0
      },
      hasTrial: {
        type: Boolean
      },
      addedBy: {
        type: Schema.Types.ObjectId,
        ref: "users",
      },
      isDeleted: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      // days: String,
      planType: {
        type: String,
        enum: ["free", "paid"],
        default: "free",
      },
      offMarket: {
        type: Boolean
      },
      leadsLevelOfFinanciabilityCheck: {
        type: Boolean
      },
      numberLeadsLevelOfFinanciabilityCheck: { type: Number },
      dailyCampaignLimit: { type: Number },
      weeklyCampaignLimit: { type: Number },
      monthlyCampaignLimit: { type: Number },
      profileInPro: { type: Boolean }, // key to show the availability in Profile section
      // White-label (marque blanche)
      whiteLabelEnabled: { type: Boolean, default: false },
      whiteLabelMaxLeads: { type: Number, default: 50 },
      // Learning Center — publication de contenu par les pros
      learningCenterEnabled: { type: Boolean, default: false },
      // Marketplace — accès à la marketplace de services par les pros
      marketplaceEnabled: { type: Boolean, default: false },
    },
    { timestamps: true }
  );

  const plans = mongoose.model("plans", schema);

  return plans;
};
