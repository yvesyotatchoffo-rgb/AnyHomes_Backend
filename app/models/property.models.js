var Mongoose = require("mongoose"),
    Schema = Mongoose.Schema;
module.exports = (mongoose) => {

    const imageSchema = new Schema({
        fileName: { type: String, },
        originalname: { type: String, }
    });

    const renovationWorkSchema = new Schema({
        title: { type: Schema.Types.ObjectId, ref: 'revenuemanagements', },
        description: { type: String, },
        price: { type: String },
        renovationDate: { type: Date },
        status: { type: Boolean, },
        images: [imageSchema],
        document: { type: Array }
    });

    const ratingSchema = new Schema({
        type: { type: Schema.Types.ObjectId, ref: 'revenuemanagements', },
        rating_value: { type: String, },
        url: { type: String, }
    });

    const expensesSchema = new Schema({
        type: { type: Schema.Types.ObjectId, ref: 'revenuemanagements' },
        year: { type: String, },
        price: { type: String, },
        document: { type: Array }
    });

    const revenueDetailSchema = new Schema({
        type: { type: Schema.Types.ObjectId, ref: 'revenuemanagements' },
        source: { type: Schema.Types.ObjectId, ref: 'revenuemanagements' },
        year: { type: String, },
        price: { type: String, },
        document: { type: Array },
        status: { type: Boolean, },
    })

    var schema = mongoose.Schema(
        {
            name: { type: String },
            location: Object,
            newlocation: {
                type: { type: String, enum: ["Point"], required: true },
                coordinates: { type: [Number], required: true },
            },
            email: String,
            amenities: {
                type: [Schema.Types.ObjectId],
                ref: "amenities",
                default: [],
            },
            images: Array,
            content: String,
            address: String,
            zipcode: String,
            country: String,
            city: String,
            state: String,
            price: Number,  //sale
            type: {
                type: String, enum: ["apartment", "castle", "farm", "building", "house"], required: true,
            },   // what type of property it is 
            featured: { type: Boolean, default: false, index: true },
            agency: { type: Schema.Types.ObjectId, ref: "users", index: true },
            publisher: Object,
            publisherType: { type: String },
            publisherPhone: { type: String },
            // like: { type: [Schema.Types.ObjectId], ref: "users", default: [] },
            like: [{ type: Schema.Types.ObjectId, ref: "users", default: [] }],
            // follow: { type: [Schema.Types.ObjectId], ref: "users", default: [] },
            follow: [{ type: Schema.Types.ObjectId, ref: "users", default: [] }],
            categories: {
                type: Schema.Types.ObjectId,
                ref: "categories",
                index: true,
            },
            status: { type: String, default: "active", enum: ["inactive", "active"] },
            addedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
            // ownedBy: { type: Schema.Types.ObjectId, ref: "users", index: true },
            importBy: { type: String, default: "platform", enum: ["user", "platform"] },
            area: { type: String },
            bedrooms: { type: String },
            rooms: { type: String },
            bathroom: { type: String },
            surface: { type: String },
            propertyFloor: { type: String },
            toilets: { type: String },
            livingRoom: { type: String },
            totalFloorBuilding: { type: String },
            propertyMonthlyCharges: { type: Number },  //rent
            guaranteeDeposit: { type: Number }, //rent
            propertyInventory: { type: Number }, //rent
            landSurface: { type: Number },
            situation: { type: Array },   //Souplex   Duplex
            building: { type: String },   //year of construction
            propertyState: { type: Schema.Types.ObjectId, ref: "revenueManagement" },
            externalUrl: { type: String },
            favoriteCount: { type: Number, default: 0 },
            pricePerSquareMeter: { type: Number },
            priceStats: Object,
            history: { type: Array, default: [] },
            creationDate: Date,
            publicationDate: Date,
            deletionDate: Date,
            lastCheckDate: Date,
            lastEventDate: Date,
            lastChangeDate: Date,
            lastModificationDate: Date,
            lastPriceChangeDate: Date,
            lastPublicationDate: Date,
            transactionTypeSource: { type: String },
            inseeCode: { type: String },
            departmentCode: { type: String },
            regionCode: { type: String },
            equipment: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // outside: { type: Array, default: [] },
            outside: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // serviceAccessibility: { type: Array, default: [] },
            serviceAccessibility: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // ancilliary: { type: Array, default: [] },
            ancilliary: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // environment: { type: Array, default: [] },
            environment: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // leisure: { type: Array, default: [] },
            leisure: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // investment: { type: Array, default: [] },
            investment: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            isDeleted: { type: Boolean, default: false },
            propertyType: {
                type: String,
                enum: ["sale", "rent", "directory"],
                index: true,
                required: true,
            },
            offMarket: { type: Boolean, default: false },
            chooseDocumentGrade: { type: String, enum: ["A", "B", "C", "D", "E", "Any"], default: "Any" },
            chooseDocumentMinProbability: { type: Number, min: 0, max: 100, default: 0 },
            isChoosedDocumentVerified: { type: Boolean, default: false },
            isChoosedDeclDocumentVerified: { type: Boolean, default: false },
            maximumLead: String,
            // cooking: { type: Array, default: [] },
            cooking: [{ type: Schema.Types.ObjectId, ref: "amenities" }],
            // heatingType: { type: String, default: "" },
            heatingType: { type: Schema.Types.ObjectId, ref: "amenities" },
            // energymode: { type: String, default: "" },
            energymode: { type: Schema.Types.ObjectId, ref: "amenities" },
            dateOfDiagnosis: { type: String },
            diagnosisType: { type: String, enum: ["Yes, I know the results", "No, I will add them later", "Diagnosis does not apply to my property"] },
            energyConsumption: { type: String, default: "" },
            energy_efficient: { type: String, enum: ["A", "B", "C", "D", "E"] },
            emission_efficient: { type: String, enum: ["A", "B", "C", "D", "E"] },

            emissions: { type: String, default: "" },
            diagnosisDate: { type: String },
            contact: { type: Boolean, default: false },
            transparency: { type: Boolean, default: false },
            username: { type: String, default: "" },
            phoneNumber: { type: String, default: "" },
            propertyCharges: { type: Number }, //sale & rent
            usedAs: { type: String, enum: ["investment", "own usage",] },
            propertyAgencyFees: { type: Number },  //sale & rent
            propertyTitle: { type: String, required: true },
            sale_my_property: { type: Boolean, default: false },
            real_estate_market: { type: Boolean, default: false },
            add_more_step: { type: Boolean, default: false, index: true },
            // revenue_detail: { type: Array },
            revenue_detail: [revenueDetailSchema],
            // renovation_work: { type: Array },
            renovation_work: [renovationWorkSchema],
            // rating: { type: Array },
            rating: [ratingSchema],
            // Expenses: { type: Array },
            Expenses: [expensesSchema],
            createdAt: Date,
            updatedAt: Date,
            searchType: { type: String },
            proposal: { type: String, enum: ["rental", "purchase", "both"] },
            userLeads: { type: String },
            rateLeads: { type: String },
            maxLeads: { type: String },
            handleBy: { type: String },
            agencyType: { type: String },
            request_status: {
                type: String,
                enum: ["accepted", "pending", "rejected"],
                default: "pending",
            },
            exactLocation: { type: Boolean, default: true },
            randomLocation: Object,
            interestUpdatedTime: { type: Date }, // key to symbolize latest funnel activity update in this property
            visitSlots: { type: Array, default: [] },  //visit slots added during the funnel by owner to visit the property
            sellerFiles: { type: Object },
            autoInvite: { type: Boolean, default: false },
            signingSlots: { type: Array, default: [] },
            homeInventorySlots: { type: Array, default: [] },
            offerStatus: { type: Boolean, default: false },
            visitBookedCount: { type: Number, default: 0 }, // key to get the number of visits booked by buyers
            contractSigned: { type: Boolean, default: false }, //key used for both rent/sale about the contract has been signed
            activityIndicatorCount: { type: Number },
            chatSorting: { type: Date },    //key to get sorting of property with latest chatted on top
            identityVerified: { type: Boolean, default: false },     // key refer if POI is upoaded or not
            linkedSchools: [
                {
                    schoolId: { type: Schema.Types.ObjectId, ref: "schools" },
                    type: {
                        type: String,
                        enum: ["elementarySchool", "college", "kindergarten", "elementaryPrimary", "highschool"],
                        required: true
                    },
                    EstablishmentName: { type: String }
                }
            ],
            referencePrice: { type: Number },
            pricePerSqm: { type: Number },
            shareCount: { type: Number, default: 0 },
            propertyViewerCount: { type: Number, default: 0 },
            directoryPurchaseProsals: { type: String, enum: ["sale", "rent", "both"] },
            propertyRef: { type: String, unique: true, sparse: true, index: true }
        },
        { timestamps: true }
    );

    // Auto-generate a unique human-readable reference on first save
    schema.pre('save', async function (next) {
        if (this.isNew && !this.propertyRef) {
            const Property = mongoose.model('properties');
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let ref, exists;
            do {
                ref = 'AH-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                exists = await Property.findOne({ propertyRef: ref });
            } while (exists);
            this.propertyRef = ref;
        }
        next();
    });

    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });
    schema.index({ newlocation: "2dsphere" });
    // schema.index({ randomLocation: "2dsphere" });  //for random location key

    // Performance indexes—évitent les full collection scans sur listing
    schema.index({ isDeleted: 1, status: 1, createdAt: -1 });
    schema.index({ isDeleted: 1, status: 1, addedBy: 1 });
    schema.index({ isDeleted: 1, status: 1, propertyType: 1, createdAt: -1 });
    schema.index({ zipcode: 1, isDeleted: 1 });

    const property = mongoose.model("properties", schema);
    return property;
};