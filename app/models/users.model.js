var Mongoose = require("mongoose"),
  Schema = Mongoose.Schema;
module.exports = (mongoose) => {
  var schema = mongoose.Schema(
    {
      firstName: String,
      lastName: String,
      fullName: String,
      companyName: String,
      email: { type: String, required: true, unique: true },
      password: String,
      // password: {type: String, select: false},
      verificationCode: String,
      dialCode: String,
      image: String,
      address: String,
      city: String,
      street: String,
      state: String,
      country: String,
      pinCode: String,
      mobileNo: String,
      username: String,
      registrationNumber: String,
      companyRole: {
        type: String,
      },
      isOnline: { type: Boolean },

      amenities: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
      images: Array,
      doc_status: { type: String, default: "pending" },
      addedType: { type: String, enum: ["self", "admin"], default: "self" },
      addedBy: { type: Schema.Types.ObjectId, ref: "users" },
      isVerified: { type: String, default: "N" },
      docVerified: { type: String, default: "N" },
      permissions: { type: Array, default: [] },
      role: {
        type: String,
        enum: ["user", "staff", "admin", "agency", "agent", "hunter"],
        default: "user"
      },
      accountType: {
        type: String,
        enum: ["individual", "pro"],
        default: "individual"
      },
      // Marketplace discovery statuses for pro users
      isGlobalFavorite: { type: Boolean, default: false },
      isLocalFavorite: { type: Boolean, default: false },
      localFavoritePostalCodes: [{ type: String }],
      isTopAgent: { type: Boolean, default: false },
      // Featured agent profile details for marketplace favorites
      featuredSubheading: { type: String },
      featuredTitle: { type: String },
      featuredBio: { type: String },
      featuredExperienceYears: { type: Number, default: 0 },
      featuredClientsAccompanied: { type: Number, default: 0 },
      featuredRatingNotes: { type: String },
      featuredSatisfactionRate: { type: String },
      featuredProfilePhoto: { type: String },
      status: { type: String, default: "active" },
      stripe_subscriptionId: String,
      // Stripe Connect — marketplace de services
      stripeConnectAccountId: { type: String, default: null },
      stripeConnectActive: { type: Boolean, default: false },
      property: String,
      propertyFor: String,
      isDeleted: { type: Boolean, default: false },
      createdAt: Date,
      updatedAt: Date,
      coordinates: Object,
      otp: Number,
      servicesOffered: Array,
      companyLogo: String,
      coverImage: String,
      website: String,
      tagline: String,
      // signup objective provided during account creation (normalized values)
      signupObjective: {
        type: String,
        enum: [
          "Acheter",
          "Louer",
          "Planifier mon projet",
          "Opportunités hors marché",
          "Vendre ma propriété",
          "Louer ma propriété",
          "Évaluer ma propriété",
          "Préparer une vente future"
        ],
        default: null,
      },
      about: String,
      companyContactNumber: String,
      companyEmail: String,
      openingHours: Array,
      servicesYouOffer: Array,
      closingHours: Array,
      location: Object,
      deviceToken: String,
      unread_notifications_count: Number,
      kwh: String,
      team: { type: Array, default: [] },
      renterFiles: Object,
      declarativeRenterFiles: {
        postalCode: String,
        InvestOption: { type: String, enum: ["primary", "secondary", "rentalProperty", "business", "mix"] },
        BuyOption: { type: String, enum: ["alone", "two", "sci"] }
      },
      sellerFiles: Object,
      buyerFiles: Object,

      // keys to track user files
      sellerFilesAddedAt: { type: Date, default: null },
      buyerFilesAddedAt: { type: Date, default: null },
      renterFilesAddedAt: { type: Date, default: null },
      //

      declarativeBuyerFiles: {
        postalCode: String,
        BuyOption: { type: String },
        InvestOption: { type: String },
        propertyType: { type: String },
        purchasePrice: { type: Number },
        age: { type: Number },
        coBorrowerAge: { type: Number },
        numberChildren: { type: Number },
        livingArrangement: { type: String },
        residenceLocation: { type: String },
        residencePostalCode: { type: String },
        housingSituation: { type: String },
        employmentCategory: { type: String },
        employmentSector: { type: String },
        employmentContract: { type: String },
        employmentGrade: { type: String },
        probationStatus: { type: String },
        salaryType: { type: String },
        salaryAmount: { type: Number },
        bonusReceived: { type: String },
        bonusType: { type: String },
        bonusAmount: { type: Number },
        additionalIncome: { type: String },
        additionalIncomeAmount: { type: Number },
        creditSituation: { type: String },
        creditType: { type: String },
        creditMonthlyAmount: { type: Number },
        creditEntries: [
          {
            creditType: { type: String },
            creditMonthlyAmount: { type: Number },
          },
        ],
        alimonyPayment: { type: String },
        alimonyAmount: { type: Number },
        spouseAlimony: { type: String },
        spouseAlimonyAmount: { type: Number },
        ownContribution: { type: Number },
        remainingSavings: { type: Number },
      },
      documentGrade: { type: String, enum: ["A", "B", "C", "D", "E", "Any"], default: "Any" },
      isDocumentVerified: { type: Boolean, default: false, default: false },
      isDeclDocumentVerified: { type: Boolean, default: false, default: false },
      financingReferenceScore: { type: Number, min: 0, max: 100, default: 0 },
      financingReferenceScoreSource: { type: String, enum: ["auto", "admin", "verified"], default: "auto" },
      financingReferenceScoreUpdatedAt: { type: Date },
      isBlocked: { type: Boolean, default: false },
      customerId: { type: String },
      subscriptionId: { type: String },                  // current subscriptionId
      planId: { type: Schema.Types.ObjectId, ref: "plans" },   //current planId 
      planType: { type: String, enum: ["paid", "free", null], default: null },     // if paid or free
      planDuration: { type: String, enum: ["month", "year"], },        // if paid then duration
      url: String,
      twoStepsEnable: { type: String, enum: ["active", "inactive"], default: "inactive" },
      totalInterests: { type: Number },
      freeTrialStatus: { type: String, enum: ["done", "pending"], default: "pending" },   //if trial used then done else pending
      trialUserForPlan: { type: Schema.Types.ObjectId, ref: "plans" },   // what plan user used for trial
      trialPlanDate: Date,
      directoryMessageUsage: { type: Number, default: 0 }, //message used per day for directory
      totalOwnerMessages: { type: Number, default: 0 },    // message used per day to normal users
      buyerfileIdenityVerification: { type: Boolean, default: false },
      renterfileIdenityVerification: { type: Boolean, default: false },
      dailyCampaignUsage: { type: Number, },
      weeklyCampaignUsage: { type: Number, },
      monthlyCampaignUsage: { type: Number, }, //depends acc to plan
      isImported: { type: Boolean }, //if true key to identify if the user is imported via csv
    },

    { timestamps: true }
  );

  schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  const Users = mongoose.model("users", schema);
  return Users;
};
