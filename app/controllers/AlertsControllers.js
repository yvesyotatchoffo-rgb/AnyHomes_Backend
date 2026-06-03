const db = require("../models");
const { message } = require("../services");
const { success } = require("../services/Response");
const constants = require("../utls/constants");
const Alerts = db.alerts;

module.exports = {
    addAlerts: async (req, res) => {
        try {
            let data = req.body;
            if (!data.user_id || !data.email) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.PAYLOAD_MISSING,
                });
            }
            data.addedBy = req.identity.id;
            const createAlerts = await Alerts.create(data);
            return res.status(200).json({
                success: true,
                message: "Alert added successfully."
            })
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: {
                    code: 500,
                    message: "" + err,
                },
            });
        }
    },
    getAlerts: async (req, res) => {
        try {
            const isGuestReq = req.isGuest || req.query.guest === 'true' || req.headers['x-guest-mode'] === 'true';
            if (isGuestReq) {
                const mockAlerts = [
                    {
                        id: 'guest-alert-1',
                        _id: 'guest-alert-1',
                        name: 'Appartement centre',
                        filteredData: {
                            propertyType: 'apartment',
                            minPrice: 120000,
                            maxPrice: 250000,
                            rooms: 3,
                        },
                        totalcount: 12,
                    },
                    {
                        id: 'guest-alert-2',
                        _id: 'guest-alert-2',
                        name: 'Maison avec jardin',
                        filteredData: {
                            propertyType: 'house',
                            minPrice: 280000,
                            maxPrice: 600000,
                            minSurface: 80,
                            maxSurface: 200,
                        },
                        totalcount: 5,
                    },
                ];
                return res.status(200).json({
                    success: true,
                    data: {
                        message: 'Mock alerts for guest mode',
                        alerts: mockAlerts,
                        totalAlerts: mockAlerts.length,
                    },
                });
            }
            let {
                search,
                rooms,
                // page,
                accountType,
                follow_unfollow,
                // count,
                // sortBy,
                address,
                status,
                minSurface,
                maxSurface,
                categories,
                agencyId,
                type,
                propertyType,
                addedBy,
                userId,
                amenities,
                minPrice,
                maxPrice,
                energy_efficient,
                propertyFloor,
                bedrooms,
                favourites,
                cooking,
                equipment,
                serviceAccessibility,
                outside,
                add_more_step,
                environment,
                leisure,
                ancilliary,
                investment,
                situation,
                userLng,
                userLat,
                maxDistance,
                request_status,
                proposal,

            } = req.query;
            var query = {};
            if (agencyId) {
                query.agency = new mongoose.Types.ObjectId(agencyId);
            }
            if (search) {
                const searchTerms = search.split(/\s+/);
                query.$or = [];
                searchTerms.forEach((term) => {
                    query.$or.push(
                        { name: { $regex: term, $options: "i" } },
                        { content: { $regex: term, $options: "i" } },
                        { address: { $regex: term, $options: "i" } },
                        { country: { $regex: term, $options: "i" } },
                        { state: { $regex: term, $options: "i" } },
                        { zipcode: { $regex: term, $options: "i" } },
                        { city: { $regex: term, $options: "i" } },
                        { email: { $regex: term, $options: "i" } },
                        { propertyTitle: { $regex: term, $options: "i" } }
                    );
                });
            }
            query.isDeleted = false;
            if (type) {
                type = await string_toString_array(type);
                const regexPattern = type.map((type) => new RegExp(type, "i"));
                query.type = { $in: regexPattern };
            }
            if (rooms) {
                const roomsArray = rooms.split(',').map(String);
                query.rooms = { $in: roomsArray };
            }
      
            if (bedrooms) {
                const bedroomsArray = bedrooms.split(',').map(String);
                query.bedrooms = { $in: bedroomsArray };
            }
            if (energy_efficient) {
                query.energy_efficient = energy_efficient;
            }
            if (minSurface || maxSurface) {
                const surfaceFilter = {};
                if (!isNaN(minSurface)) {
                    surfaceFilter.min = Number(minSurface); 
                }
                if (!isNaN(maxSurface)) {
                    surfaceFilter.max = Number(maxSurface); 
                }

                if (Object.keys(surfaceFilter).length) {
                    query.$expr = {
                        $and: [
                            surfaceFilter.min !== undefined ? { $gte: [{ $toDouble: "$surface" }, surfaceFilter.min] } : {},
                            surfaceFilter.max !== undefined ? { $lte: [{ $toDouble: "$surface" }, surfaceFilter.max] } : {},
                        ].filter(Boolean),
                    };
                }
            }
   
            if (minPrice || maxPrice) {
                const priceFilter = {};
                if (!isNaN(minPrice)) {
                    priceFilter.$gte = Number(minPrice);
                }
                if (!isNaN(maxPrice)) {
                    priceFilter.$lte = Number(maxPrice);
                }
                if (Object.keys(priceFilter).length) {
                    query.price = priceFilter;
                }
            }
            if (status) {
                query.status = status;
            }
            if (request_status) {
                query.request_status = request_status;
            }
            if (categories) {
                query.categories = new mongoose.Types.ObjectId(categories);
            }
            if (propertyType) {
                query.propertyType = propertyType;
            }
            if (accountType) {
                query.accountType = accountType;
            }
            if (follow_unfollow) {
                if (follow_unfollow == "true") {
                    query.followunfollows_details = true;
                } else if (follow_unfollow == "false") {
                    query.followunfollows_details = false;
                }
            }
            if (favourites) {
                if (favourites == "true") {
                    query.favourite_details = true;
                } else if (favourites == "false") {
                    query.favourite_details = false;
                }
            }
            if (add_more_step) {
                if (add_more_step == "true") {
                    query.add_more_step = true;
                } else if (add_more_step == "false") {
                    query.add_more_step = false;
                }
            }
            if (addedBy) {
                query.addedBy = new mongoose.Types.ObjectId(addedBy);
            }
            if (address) {
                address = await string_toString_array(address);
                const regexPattern = address.map((type) => new RegExp(type, "i"));
                query.address = { $in: regexPattern };
            }
            if (amenities) {
                amenities = amenities
                    .split(",")
                    .map((id) => new mongoose.Types.ObjectId(id.trim()));
                query.amenities = { $in: amenities };
            }
            if (cooking) {
                let cookingArray = cooking.split(",").map(id => id.trim());

                query.cooking = { $in: cookingArray };
            }
            if (equipment) {
                const equipmentArray = equipment.split(",").map((id) => (id.trim()));
                query.equipment = { $in: equipmentArray };
            }
            if (serviceAccessibility) {
                const serviceAccessibilityArray = serviceAccessibility.split(",").map((id) => (id.trim()));
                query.serviceAccessibility = { $in: serviceAccessibilityArray };
            }
            if (outside) {
                const outsideArray = outside.split(",").map((id) => (id.trim()));
                query.outside = { $in: outsideArray };
            }
            if (environment) {
                const environmentArray = environment.split(",").map((id) => (id.trim()));
                query.environment = { $in: environmentArray };
            }
            if (leisure) {
                const leisureArray = leisure.split(",").map((id) => (id.trim()));
                query.leisure = { $in: leisureArray };
            }
            if (ancilliary) {
                const ancilliaryArray = ancilliary.split(",").map((id) => (id.trim()));
                query.ancilliary = { $in: ancilliaryArray };
            }
            if (investment) {
                investment = await string_toString_array(investment);
                const regexPattern = investment.map((type) => new RegExp(type, "i"));
                query.investment = { $in: regexPattern };
            }
            if (situation) {
                situation = await string_toString_array(situation);
                const regexPattern = situation.map((type) => new RegExp(type, "i"));
                query.situation = { $in: regexPattern };
            }
            let userIdObj;
            if (userId) {
                userIdObj = new mongoose.Types.ObjectId(userId);
            }
            if (maxDistance) {
                maxDistance = Number(maxDistance);
            }

            if (propertyFloor) {
                const propertyFloorArray = propertyFloor.split(',').map(String);
                query.propertyFloor = { $in: propertyFloorArray };
            }
            if (proposal) {
                query.proposal = proposal;

            }
            const pipeline = [
                {
                    $lookup: {
                        from: "amenities",
                        localField: "amenities",
                        foreignField: "_id",
                        as: "amenitiesDetails",
                    },
                },
                {
                    $unwind: {
                        path: "$amenitiesDetails",
                        preserveNullAndEmptyArrays: true,
                    },
                },

                {
                    $lookup: {
                        from: "categories",
                        localField: "categories",
                        foreignField: "_id",
                        as: "categoriesDetails",
                    },
                },
                {
                    $unwind: {
                        path: "$categoriesDetails",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "agency",
                        foreignField: "_id",
                        as: "agencyDetails",
                    },
                },

                {
                    $lookup: {
                        from: "users",
                        localField: "like",
                        foreignField: "_id",
                        as: "likedUsers",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "follow",
                        foreignField: "_id",
                        as: "followUsers",
                    },
                },

                {
                    $lookup: {
                        from: "users",
                        localField: "addedBy",
                        foreignField: "_id",
                        as: "addedBy_details",
                    },
                },

                {
                    $unwind: {
                        path: "$addedBy_details",
                        preserveNullAndEmptyArrays: true,
                    },
                },

                {
                    $lookup: {
                        from: "favorites",
                        let: { property_id: "$_id", user_id: userIdObj },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$property_id", "$$property_id"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "favourite_details",
                    },
                },
                {
                    $unwind: {
                        path: "$favourite_details",
                        preserveNullAndEmptyArrays: true,
                    },
                },

                {
                    $lookup: {
                        from: "followunfollows",
                        let: { property_id: "$_id", user_id: userIdObj },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$property_id", "$$property_id"] },
                                            { $eq: ["$user_id", "$$user_id"] },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "followunfollows_details",
                    },
                },
                {
                    $unwind: {
                        path: "$followunfollows_details",
                        preserveNullAndEmptyArrays: true,
                    },
                },

                {
                    $lookup: {
                        from: "messages",
                        let: { property_id: "$_id", status: "unread" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$property_id", "$$property_id"] },
                                            { $eq: ["$status", "$$status"] },
                                        ],
                                    },
                                },
                            },
                        ],
                        as: "new_messages",
                    },
                },

                {
                    $lookup: {
                        from: "favorites",
                        let: { property_id: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$property_id", "$$property_id"] },
                                            { $eq: ["$like", true] },
                                        ],
                                    },
                                },
                            },
                            {
                                $count: "likeCount",
                            },
                        ],
                        as: "favourite_count",
                    },
                },
                {
                    $lookup: {
                        from: "followunfollows",
                        let: { property_id: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$property_id", "$$property_id"] },
                                            { $eq: ["$follow_unfollow", true] },
                                        ],
                                    },
                                },
                            },
                            {
                                $count: "followerCount",
                            },
                        ],
                        as: "followers_count",
                    },
                },
                {
                    $project: {
                        _id: 1,
                        id: "$_id",
                        // name: 1,
                        email: 1,
                        // lng: 1,
                        // lat: 1,
                        location: 1,
                        distance: 1,
                        address: 1,
                        state: 1,
                        country: 1,
                        zipcode: 1,
                        categories: 1,
                        categoriesDetails: "$categoriesDetails",
                        amenitiesDetails: 1,
                        type: 1,
                        city: 1,
                        price: 1,
                        propertyType: 1,
                        likedUsers: {
                            $map: {
                                input: "$likedUsers",
                                as: "user",
                                in: {
                                    id: "$$user._id",
                                    name: "$$user.fullName",
                                },
                            },
                        },
                        followUsers: {
                            $map: {
                                input: "$followUsers",
                                as: "user",
                                in: {
                                    id: "$$user._id",
                                    name: "$$user.fullName",
                                },
                            },
                        },
                        createdAt: 1,
                        updatedAt: 1,
                        images: 1,
                        content: 1,
                        status: 1,
                        isDeleted: 1,
                        agency: 1,
                        surface: 1,
                        propertyFloor: 1,
                        toilets: 1,
                        livingRoom: 1,
                        rooms: 1,
                        bedrooms: 1,
                        totalFloorBuilding: 1,
                        situation: 1,
                        building: 1,
                        state: 1,
                        equipment: 1,
                        outside: 1,
                        serviceAccessibility: 1,
                        ancilliary: 1,
                        environment: 1,
                        leisure: 1,
                        investment: 1,
                        agencyDetails: "$agencyDetails",
                        cooking: 1,
                        heatingType: 1,
                        energymode: 1,
                        dateOfDiagnosis: 1,
                        diagnosisType: 1,
                        energyConsumption: 1,
                        emissions: 1,
                        energy_efficient: 1,
                        emission_efficient: 1,
                        diagnosisDate: 1,
                        contact: 1,
                        transparency: 1,
                        username: 1,
                        phoneNumber: 1,
                        propertyCharges: 1,
                        propertyAgencyFees: 1,
                        propertyTitle: 1,
                        sale_my_property: 1,
                        real_estate_market: 1,
                        userLeads: 1,
                        rateLeads: 1,
                        maxLeads: 1,
                        exactLocation: 1,
                        randomLocation: 1,
                        request_status: "$request_status",
                        addedBy: "$addedBy",
                        amenities: "$amenitiesDetails._id",
                        cooking_id: "$cooking",
                        favourite_details: { $ifNull: ["$favourite_details.like", false] },
                        revenue_detail: "$revenue_detail",
                        renovation_work: "$renovation_work",
                        rating: "$rating",
                        Expenses: "$Expenses",
                        addedBy_details: "$addedBy_details",
                        accountType: "$addedBy_details.accountType",
                        add_more_step: "$add_more_step",
                        propertyMonthlyCharges: "$propertyMonthlyCharges",
                        favourite_details: { $ifNull: ["$favourite_details.like", false] },
                        new_messages: { $size: "$new_messages" },
                        searchType: "$searchType",
                        guaranteeDeposit: "$guaranteeDeposit",
                        propertyInventory: "$propertyInventory",
                        proposal: "$proposal",
                        handleBy: "$handleBy",
                        agencyType: "$agencyType",
                        followunfollows_details: {
                            $ifNull: ["$followunfollows_details.follow_unfollow", false],
                        },
                        likeCount: {
                            $ifNull: [{ $arrayElemAt: ["$favourite_count.likeCount", 0] }, 0],
                        },
                        followerCount: {
                            $ifNull: [
                                { $arrayElemAt: ["$followers_count.followerCount", 0] },
                                0,
                            ],
                        },
                    },
                },
                {
                    $match: query,
                },
            ];
            let group_stage = {
                $group: {
                    _id: "$_id",
                    email: { $first: "$email" },
                    // name: { $first: "$name" },
                    location: { $first: "$location" },
                    // lng: { $first: "$lng" },
                    // lat: { $first: "$lat" },
                    address: { $first: "$address" },
                    state: { $first: "$state" },
                    country: { $first: "$country" },
                    zipcode: { $first: "$zipcode" },
                    categories: { $first: "$categories" },
                    categoriesDetails: { $first: "$categoriesDetails" },
                    type: { $first: "$type" },
                    city: { $first: "$city" },
                    price: { $first: "$price" },
                    propertyType: { $first: "$propertyType" },
                    likedUsers: { $first: "$likedUsers" },
                    followUsers: { $first: "$followUsers" },
                    createdAt: { $first: "$createdAt" },
                    updatedAt: { $first: "$updatedAt" },
                    images: { $first: "$images" },
                    content: { $first: "$content" },
                    status: { $first: "$status" },
                    isDeleted: { $first: "$isDeleted" },
                    agency: { $first: "$agency" },
                    surface: { $first: "$surface" },
                    propertyFloor: { $first: "$propertyFloor" },
                    toilets: { $first: "$toilets" },
                    livingRoom: { $first: "$livingRoom" },
                    rooms: { $first: "$rooms" },
                    bedrooms: { $first: "$bedrooms" },
                    exactLocation: { $first: "$exactLocation" },
                    randomLocation: { $first: "$randomLocation" },
                    totalFloorBuilding: { $first: "$totalFloorBuilding" },
                    situation: { $first: "$situation" },
                    building: { $first: "$building" },
                    equipment: { $first: "$equipment" },
                    outside: { $first: "$outside" },
                    serviceAccessibility: { $first: "$serviceAccessibility" },
                    ancilliary: { $first: "$ancilliary" },
                    environment: { $first: "$environment" },
                    leisure: { $first: "$leisure" },
                    investment: { $first: "$investment" },
                    agencyDetails: { $first: "$agencyDetails" },
                    cooking: { $first: "$cooking" },
                    heatingType: { $first: "$heatingType" },
                    energymode: { $first: "$energymode" },
                    new_messages: { $first: "$new_messages" },
                    dateOfDiagnosis: { $first: "$dateOfDiagnosis" },
                    diagnosisType: { $first: "$diagnosisType" },
                    energyConsumption: { $first: "$energyConsumption" },
                    emissions: { $first: "$emissions" },
                    energy_efficient: { $first: "$energy_efficient" },
                    emission_efficient: { $first: "$emission_efficient" },
                    diagnosisDate: { $first: "$diagnosisDate" },
                    contact: { $first: "$contact" },
                    transparency: { $first: "$transparency" },
                    username: { $first: "$username" },
                    phoneNumber: { $first: "$phoneNumber" },
                    propertyCharges: { $first: "$propertyCharges" },
                    propertyAgencyFees: { $first: "$propertyAgencyFees" },
                    propertyTitle: { $first: "$propertyTitle" },
                    sale_my_property: { $first: "$sale_my_property" },
                    real_estate_market: { $first: "$real_estate_market" },
                    addedBy: { $first: "$addedBy" },
                    amenitiesDetails: { $first: "$amenitiesDetails" },
                    favourite_details: { $first: "$favourite_details" },
                    addedBy_details: { $first: "$addedBy_details" },
                    accountType: { $first: "$accountType" },
                    add_more_step: { $first: "$add_more_step" },
                    likeCount: { $first: "$likeCount" },
                    followerCount: { $first: "$followerCount" },
                    rating: { $first: "$rating" },
                    revenue_detail: { $first: "$revenue_detail" },
                    renovation_work: { $first: "$renovation_work" },
                    Expenses: { $first: "$Expenses" },
                    propertyMonthlyCharges: { $first: "$propertyMonthlyCharges" },
                    request_status: { $first: "$request_status" },
                    cooking: { $first: "$cooking" },
                    equipment: { $first: "$equipment" },
                    serviceAccessibility: { $first: "$serviceAccessibility" },
                    outside: { $first: "$outside" },
                    environment: { $first: "$environment" },
                    leisure: { $first: "$leisure" },
                    ancilliary: { $first: "$ancilliary" },
                    followunfollows_details: { $first: "$followunfollows_details" },
                    searchType: { $first: "$searchType" },
                    proposal: { $first: "$proposal" },
                    guaranteeDeposit: { $first: "$guaranteeDeposit" },
                    propertyInventory: { $first: "$propertyInventory" },
                },
            };
            const user_id = req.identity.id;
            const sortBy = req.query.sortBy || "createdAt"; 
            const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;
            const alerts = await Alerts.find({ user_id: user_id, isDeleted: false }).sort({ [sortBy]: sortOrder });
            let totalAlerts = alerts.length;
            const alertsWithTotalCount = alerts.map(alert => {
                return { ...alert._doc, totalcount: alert._doc.totalcount || 0 };
            });
            return res.status(200).json({
                success: true,
              data: { 
                message: "Alerts retrieved successfully.",
                alerts: alertsWithTotalCount,
                totalAlerts: totalAlerts,
                // total: total.length
              }
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: "Failed to get Alerts",
                err: err.message,
            })
        }
    },

    deleteAlerts: async (req, res) => {
        try {
            const user_id = req.identity.id;
            const id = req.query.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Please select an alert to delete."
                })
            }
            const erase = await Alerts.findOneAndDelete({ _id: id, user_id: user_id });
            return res.status(200).json({
                success: true,
                message: "Alert deleted succesfully",
            })
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Alert not found",
                error: err.message,
            })
        }
    }
}