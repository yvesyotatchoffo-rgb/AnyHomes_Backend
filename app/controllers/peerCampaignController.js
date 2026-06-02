const { default: mongoose } = require("mongoose");
const db = require("../models");
const agenda = require('../config/agenda.config');
const { handleServerError } = require("../utls/helper");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const { Parser } = require('json2csv');
const logActivity = require("../services/activityLog.service");



module.exports = {

  startNewCampign: async (req, res) => {
    try {
      const { duration, propertyId, referencePrice, pricePerSqm } = req.body;
      const userId = req.identity.id;

      if (!duration || !propertyId || !referencePrice || !pricePerSqm) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }

      const findUser = await db.users.findById(userId);
      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User not found."
        });
      }

      const findProperty = await db.property.findById(propertyId);
      if (!findProperty) {
        return res.status(400).json({
          success: false,
          message: "Property not found."
        });
      }

      if (findProperty.addedBy.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only property owner can start the campaign."
        });
      }

      const currentPlanId = findUser.planId;
      if (!currentPlanId) {
        return res.status(400).json({
          success: false,
          message: "Please purchase a plan."
        });
      }
      const exstingCampaign = await db.peerCampaign.findOne({ propertyId, userId, status: "active" });
      if (exstingCampaign) {
        return res.status(400).json({
          success: false,
          message: "Cannot have more than one campaign at the same time."
        })
      }

      const plan = await db.plans.findById(currentPlanId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: "Plan not found."
        });
      }
      let updateUser;
      let startDate = new Date();
      let endDate = new Date();
      let durationLimit;

      if (duration === "1Day") {
        durationLimit = plan.dailyCampaignLimit;
        // endDate.setMinutes(endDate.getMinutes() + 3);
        endDate.setDate(endDate.getDate() + 1);
        updateUser = { $inc: { dailyCampaignUsage: 1 } };

        durationCount = findUser.dailyCampaignUsage;
      } else if (duration === "1Week") {
        durationLimit = plan.weeklyCampaignLimit;
        endDate.setDate(endDate.getDate() + 7);
        updateUser = { $inc: { weeklyCampaignUsage: 1 } };

        durationCount = findUser.weeklyCampaignUsage;
      } else if (duration === "1Month") {
        durationLimit = plan.monthlyCampaignLimit;
        endDate.setMonth(endDate.getMonth() + 1);
        updateUser = { $inc: { monthlyCampaignUsage: 1 } };

        durationCount = findUser.monthlyCampaignUsage;
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid duration. Must be 1Day, 1Week, or 1Month."
        });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      // const durationCount = await db.peerCampaign.countDocuments({
      //   userId,
      //   propertyId,
      //   duration,
      //   startDate: { $gte: startOfMonth, $lte: endOfMonth }
      // });

      if (durationCount >= durationLimit) {
        return res.status(400).json({
          success: false,
          message: `Campaign limit exceeded for ${duration} in this month.`
        });
      }
      let campaignName;
      const findCampaignNumber = await db.peerCampaign.find({ propertyId, userId });
      if (findCampaignNumber.length === 0) {
        campaignName = `${findProperty.propertyTitle} campaign 1`
      } else {
        campaignName = `${findProperty.propertyTitle} campaign ${findCampaignNumber.length + 1}`
      }

      await db.property.updateOne({ _id: propertyId }, { referencePrice, pricePerSqm });

      const startCampaign = await db.peerCampaign.create({
        referencePrice,
        campaignName,
        propertyId,
        userId,
        duration,
        status: "active",
        startDate,
        endDate,
        pricePerSqm,
      });

      await db.users.updateOne({ _id: userId }, updateUser);

      await agenda.schedule(endDate, "expire-active-campaign", {
        campaginId: startCampaign._id
      });

      logActivity(userId, "campaign_launch", { label: `Campagne P2P lancée pour ${findProperty.propertyTitle || ""}`, objectType: "campaign", objectId: startCampaign._id, objectTitle: findProperty.propertyTitle || "" });

      return res.status(201).json({
        success: true,
        message: `${duration} campaign started for ${findProperty.propertyTitle}.`,
        data: startCampaign
      });

    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },

  submitPropertyEstimation: async (req, res) => {
    try {
      let data = req.body;
      data.userId = req.identity.id;
      if (
        !data.propertyId ||
        !data.userReasonablePrice ||
        !data.currentPropReferencePrice ||
        !data.currentPricePerSqm ||
        !data.referencePrice
      ) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }

      const findProperty = await db.property.findById(data.propertyId);
      if (!findProperty) {
        return res.status(400).json({
          success: false,
          message: "Property not found."
        });
      }

      const findCampaign = await db.peerCampaign.findOne({ propertyId: data.propertyId, status: "active" });
      if (findCampaign) {
        data.campaginId = findCampaign._id;
        const existingEstimation = await db.peerEstimation.findOne({
          propertyId: data.propertyId,
          userId: data.userId,
          campaginId: findCampaign._id
        })
        if (existingEstimation) {
          return res.status(400).json({
            success: false,
            message: "You have already estimated this property for this campaign."
          })
        }
      } else {
        data.campaginId = null;
        const existingEstimation = await db.peerEstimation.findOne({
          propertyId: data.propertyId,
          userId: data.userId,
          campaginId: null
        })
        if (existingEstimation) {
          return res.status(400).json({
            success: false,
            message: "You have already estimated this property."
          })
        }
      }
      if (data.userId.toString() === findProperty.addedBy.toString()) {
        return res.status(400).json({
          success: false,
          message: "Cannot estimate your own property."
        })
      }

      const saveEstimation = await db.peerEstimation.create(data);

      return res.status(200).json({
        success: true,
        message: "Property estimated.",
        data: saveEstimation
      })

    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },

  listUserCampaigns: async (req, res) => {
    try {
      let { status, propertyId, userId, search } = req.query;
      let page = req.query.page || 1;
      let count = req.query.count || 10;

      // if (userId) {
      //   filters.userId = new mongoose.Types.ObjectId(userId);
      // }

      // if (status) {
      //   filters.status = status;
      // }

      // if (propertyId) {
      //   filters.propertyId = new mongoose.Types.ObjectId(propertyId);
      // }
      let filters = {
        ...(status && { status }),
        ...(userId && { userId }),
        ...(propertyId && { propertyId }),
      };
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(count);
      const skip = (pageNumber - 1) * limitNumber;

      if (search) {
        filters.campaignName = { $regex: search, $options: 'i' }
      }

      const data = await db.peerCampaign
        .find(filters)
        .skip(skip)
        .limit(limitNumber)
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        message: "Contact list fetched successfully.",
        data: data,
        total: data.length,
      });

    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },

  getCampaignDetail: async (req, res) => {
    try {
      const { id } = req.query;
      const campaignData = await db.peerCampaign
        .findById(id)
        .populate({
          path: "peerEstimations",
          populate: {
            path: "userId",
            select: "fullName email",
          },
        })
        .populate("propertyId", "propertyTitle")
        .populate("userId", "fullName")
        .exec();
      const estimationCount = campaignData.peerEstimations?.length || 0;

      return res.status(200).json({
        success: true,
        message: "Campaign data fetched.",
        data: campaignData,
        estimationCount
      })
    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },

  downloadCampaign: async (req, res) => {
    try {
      const { id } = req.query;

      const campaignData = await db.peerEstimation.find({ campaginId: id }).populate({
        path: "userId",
        select: "fullName email",
      }).populate("propertyId", "propertyTitle").populate("campaginId", "campaignName").lean();

      if (!campaignData.length) {
        return res.status(404).json({
          success: false,
          message: "No data available for this campaign",
        });
      }

      const formattedData = campaignData.map(item => ({
        User: item.userId?.fullName || "",
        "Reference Price": item?.referencePrice || "",
        "Reasonable Price": item?.userReasonablePrice || 0,
        Title: item?.ratePropertyTitle || 0,
        Pictures: item?.ratePropertyPictures || 0,
        "Interior Design": item?.rateInteriorDesign || 0,
        Location: item?.rateLocation || 0,
        "Live in": item?.rateCouldYouLiveIn || 0,
        "Advice/Comment": item?.comment || "",
      }));

      // Convert to CSV
      const parser = new Parser({
        quote: '"',
        delimiter: ",",
      });
      const csv = parser.parse(formattedData);

      // 📤 Send as downloadable file
      res.header("Content-Type", "text/csv");
      res.header(
        "Content-Disposition",
        `attachment; filename="campaign-estimation-${id.slice(0, 10)}.csv"`
      );
      return res.send(csv);

    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },


  overAllAnalytics: async (req, res) => {
    try {
      // const userId = req.identity.id;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() - 2);

      const [analytics, topEstimators] = await Promise.all([
        db.peerEstimation.aggregate([
          {
            $facet: {
              activeEstimators: [
                { $match: { createdAt: { $gte: endDate } } },
                { $group: { _id: "$userId" } },
                { $count: "count" }
              ],

              totalEstimationsPerformed: [
                { $count: "count" }
              ],

              totalPropertiesPerformed: [
                { $group: { _id: "$propertyId" } },
                { $count: "count" }
              ]
            }
          }
        ]),
        db.peerEstimation.aggregate([
          {
            $group: {
              _id: "$userId",
              totalEstimations: { $sum: 1 },
              uniqueProperties: { $addToSet: "$propertyId" }
            }
          },
          {
            $project: {
              totalEstimations: 1,
              uniquePropertiesCount: { $size: "$uniqueProperties" }
            }
          },
          { $sort: { totalEstimations: -1 } },
          { $limit: 3 },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "user"
            }
          },
          { $unwind: "$user" },
          {
            $project: {
              _id: 1,
              fullName: "$user.fullName",
              email: "$user.email",
              images: "$user.images",
              totalEstimations: 1,
              uniquePropertiesCount: 1
            }
          }
        ])
      ])
      return res.status(200).json({
        success: true,
        message: "Analytics fetched",
        data: {
          activeEstimators: analytics[0].activeEstimators[0]?.count || 0,
          totalEstimationsPerformed: analytics[0].totalEstimationsPerformed[0]?.count || 0,
          totalPropertiesPerformed: analytics[0].totalPropertiesPerformed[0]?.count || 0,
          topEstimators
        }
      });
    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        message: err.message,
      });
    }
  },

  purchaseCampaign: async (req, res) => {
    try {
      let {
        propertyId,
        campaignType,
        amount,
        currency,
        userId,
        referencePrice,
        pricePerSqm,
        duration
      } = req.body;
      userId = req.identity.id;
      currency = currency || 'eur';

      if (
        !campaignType ||
        !amount ||
        !propertyId ||
        !referencePrice ||
        !pricePerSqm ||
        !duration
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields.",
        });
      }
      const existingCampaign = await db.peerCampaign.findOne({
        propertyId,
        status: "active"
      })

      if (existingCampaign) {
        return res.status(400).json({
          success: false,
          message: "You already have one running campaign."
        })
      }

      const findProperty = await db.property.findById(propertyId);
      if (!findProperty) {
        return res.status(400).json({
          success: false,
          message: "Property not found."
        });
      }

      if (findProperty.addedBy.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Only property owner can start the campaign."
        });
      }


      const findUser = await db.users.findOne({ _id: userId, isDeleted: false });
      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User not found."
        });
      }

      let customerId = findUser.customerId;

      let customerExists = false;
      if (customerId) {
        try {
          await stripe.customers.retrieve(customerId);
          customerExists = true;
        } catch (error) {
          console.warn("Customer not found in Stripe. Creating a new one...");
          customerExists = false;
        }
      }

      if (!customerExists) {
        const customer = await stripe.customers.create({
          email: findUser.email,
          name: findUser.fullName,
        });

        customerId = customer.id;

        await db.users.findByIdAndUpdate(userId, { customerId });
      }

      console.log("Stripe Customer ID:", customerId);

      let primary_card = await db.cards.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
        isPrimary: true,
        paymentMethod: "stripe",
      });

      if (!primary_card) {
        return res.status(400).json({
          success: false,
          message: "No primary card found."
        });
      }

      let endDate = new Date();
      if (duration === "1Day") {
        endDate.setDate(endDate.getDate() + 1);
      } else if (duration === "1Week") {
        endDate.setDate(endDate.getDate() + 7);
      } else if (duration === "1Month") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid duration. Must be 1Day, 1Week, or 1Month."
        });
      }

      let campaignName;
      const findCampaignNumber = await db.peerCampaign.find({ propertyId, userId });
      if (findCampaignNumber.length === 0) {
        campaignName = `${findProperty.propertyTitle} campaign 1`
      } else {
        campaignName = `${findProperty.propertyTitle} campaign ${findCampaignNumber.length + 1}`
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency,
        customer: customerId,
        payment_method: primary_card.cardId,
        confirm: true,
        metadata: {
          userId: String(userId),
          campaignType,
          propertyId,
          type: "campaign",
          referencePrice,
          pricePerSqm,
          duration,
          endDate,
          campaignName,
          startDate: new Date()
        },
        return_url: "https://book.jcsoftwaresolution.in/",
      });

      const paymentRecord = await db.campaignPayments.create({
        campaignType,
        amount,
        currency,
        userId,
        paymentIntendId: paymentIntent.id,
        paymentStatus: "pending",
        propertyId
      });

      return res.status(200).json({
        success: true,
        message: "Payment initiated",
        data: paymentRecord
      });

    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Internal sever error.",
        error: err.message,
      });
    }
  },

  webhook: async (req, res) => {
    try {

      const event = req.body;
      console.log("EVENTS:", event);
      if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
        const intent = event.data.object;
        const status = event.type === "payment_intent.succeeded" ? "successfull" : "failed";

        await db.campaignPayments.findOneAndUpdate(
          { paymentIntendId: intent.id },
          { paymentStatus: status },
          { new: true }
        );
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(400).json({
        success: false,
        message: "Webhook processing failed",
        error: err.message,
      });
    }
  },

  listCampaigns: async (req, res) => {
    try {
      let {
        page = 1,
        limit = 10,
        search = "",
        userId,
        propertyId
      } = req.query;

      page = parseInt(page);
      limit = parseInt(limit);

      const skip = (page - 1) * limit;

      let matchFilter = {};

      if (userId) {
        matchFilter.userId = new mongoose.Types.ObjectId(userId);
      }

      if (propertyId) {
        matchFilter.propertyId = new mongoose.Types.ObjectId(propertyId);
      }

      let pipeline = [
        { $match: matchFilter },

        {
          $lookup: {
            from: "peercampaigns",
            localField: "campaginId",
            foreignField: "_id",
            as: "campaign"
          }
        },
        { $unwind: { path: "$campaign", preserveNullAndEmptyArrays: true } },

        ...(search
          ? [
            {
              $match: {
                "campaign.campaignName": {
                  $regex: search,
                  $options: "i"
                }
              }
            }
          ]
          : []),

        {
          $lookup: {
            from: "properties",
            localField: "propertyId",
            foreignField: "_id",
            as: "property"
          }
        },
        { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

        {
          $project: {
            referencePrice: 1,
            userReasonablePrice: 1,
            currentPropReferencePrice: 1,
            currentPricePerSqm: 1,
            comment: 1,
            createdAt: 1,

            userId: 1,
            propertyId: 1,

            campaignName: "$campaign.campaignName",

            user: {
              fullName: "$user.fullName"
            },

            property: {
              propertyTitle: "$property.propertyTitle",
              address: "$property.address",
              city: "$property.city",
              zipcode: "$property.zipcode",
              surface: "$property.surface",
              rooms: "$property.rooms",
              bedrooms: "$property.bedrooms",
              referencePrice: "$property.referencePrice",
              images: "$property.images"
            }
          }
        },

        { $sort: { createdAt: -1 } },

        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            totalCount: [{ $count: "count" }]
          }
        }
      ];

      const result = await db.peerEstimation.aggregate(pipeline);

      const data = result[0].data;
      const total = result[0].totalCount[0]?.count || 0;

      return res.status(200).json({
        success: true,
        message: "Campaigns fetched successfully",
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      handleServerError(res, error, "Failed to list campaigns");
    }
  }
}