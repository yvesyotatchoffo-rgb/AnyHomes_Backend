const db = require("../models");
const constants = require("../utls/constants");
var mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const stripe = process.env.STRIPE_KEY ? require("stripe")(process.env.STRIPE_KEY) : null;

module.exports = {
  /**
   * Creating Plans
   */
  createPlans: async (req, res) => {
    try {
      let body = req.body;
      if (!body.name) {
        return {
          status: 404,
          success: false,
          error: { code: 404, message: constants.COMMON.PAYLOAD_MISSING },
        };
      }

      if(body.planType === "free"){
        const freePlan = await db.plans.findOne({planType: "free", status: "active"});
        if(freePlan){
          return res.status(400).json({
            success: false,
            message: "You must deactivate previous free plan to activate this one."
          })
        }
      }

      body.addedBy = new ObjectId(req.identity.id);
      body.name = body.name.toLowerCase();

      let query = {};
      query.name = body.name;
      query.isDeleted = false;

      var findPlan = await db.plans.findOne(query);
      if (findPlan) {
        return res.status(404).json({
          success: false,
          error: { code: 404, message: constants.PLAN.ALREADY_EXIST },
        });
      } else {
        body.isDeleted = false;
        body.status = "active";
        body.createdAt = new Date();
        body.updatedAt = new Date();
        let pricing = body.pricing;
        if (stripe) {
          const product = await stripe.products.create({
            name: body.name,
          });
          body.stripe_product_id = product.id;
          if (pricing) {
            for await (const itm of pricing) {
              const stripePrice = await stripe.prices.create({
                product: product.id,
                unit_amount: Number(itm.unit_amount) * 100,
                currency: itm.currency,
                recurring: {
                  interval: itm.interval ? itm.interval : "month",
                  interval_count: itm.interval_count ? itm.interval_count : 1,
                },
              });
              itm.stripe_price_id = stripePrice.id;
            }
          }
        }
        body.pricing = pricing;
        const planAdded = await db.plans.create(body);
        return res.status(200).json({
          status: 200,
          success: true,
          message: constants.PLAN.CREATED,
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
      });
    }
  },

  /**
   * get Plan detail
   */

  planDetail: async (req, res) => {
    try {
      const id = req.query.id;
      const detail = await db.plans
        .findOne({ _id: id, isDeleted: false })
        .populate("feature");
      if (!detail) {
        return res.status(404).json({
          status: 404,
          success: false,
          error: { status: 404, message: constants.PLAN.NOT_FOUND },
        });
      }
      return res.status(200).json({
        status: 200,
        success: true,
        data: detail,
      });
    } catch (err) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: { message: "" + err },
      });
    }
  },

  /**
   * get Plans lisitng
   */
  getPlansList: async (req, res) => {
    try {
      let search = req.query.search;
      let page = req.query.page;
      let sortBy = req.query.sortBy;
      let status = req.query.status;
      let count = req.query.count;
      let planType = req.query.planType;
      let role = req.query.role;

      let query = {};
      if (search) {
        query.$or = [{ name: { $regex: search, $options: "i" } }];
      }

      if (role) {
        query.role = role;
      }
      query.isDeleted = false;

      let sortquery = {};
      if (sortBy) {
        var order = sortBy.split(" ");
        var field = order[0];
        var sortType = order[1];
        sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1; // Default sort by createdAt descending
      }
      if (status) {
        query.status = status;
      }
      if (planType) {
        console.log("type", planType);

        query.planType = planType;
      }
      const pipeline = [
        {
          $lookup: {
            from: "features",
            localField: "feature",
            foreignField: "_id",
            as: "featureDetails",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "addedBy",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: "$name",
            status: "$status",
            interval: "$interval",
            feature: "$featureDetails",
            monthlyPrice: "$monthlyPrice",
            yearlyPrice: "$yearlyPrice",
            pricing: "$pricing",
            planType: "$planType",
            addedBy: "$userDetails",
            role: "$role",
            otherDetails: "$otherDetails",
            isDeleted: "$isDeleted",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            numberOfInterest: "$numberOfInterest",
            numberOfProperty: "$numberOfProperty",
            dailyCampaignLimit: "$dailyCampaignLimit",
            weeklyCampaignLimit: "$weeklyCampaignLimit",
            monthlyCampaignLimit: "$monthlyCampaignLimit",
            leadsLevelOfFinanciabilityCheck: "$leadsLevelOfFinanciabilityCheck",
            offMarket: "$offMarket",
            messageToDirectoryOwners: "$messageToDirectoryOwners",
            messagesToOwners: "$messagesToOwners",
            numberOfProperty: "$numberOfProperty"
          },
        },
        {
          $match: query,
        },
        {
          $sort: sortquery,
        },
      ];

      // Get total count
      const totalCountPipeline = [...pipeline];
      totalCountPipeline.push({ $count: "total" });
      const totalResult = await db.plans.aggregate(totalCountPipeline);
      const total = totalResult.length ? totalResult[0].total : 0;

      // Pagination
      if (page && count) {
        const skipNo = (Number(page) - 1) * Number(count);
        pipeline.push({ $skip: Number(skipNo) }, { $limit: Number(count) });
      }

      // Execute aggregation
      const result = await db.plans.aggregate(pipeline);

      return res.status(200).json({
        status: 200,
        success: true,
        data: result,
        total: total,
      });
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + error },
      });
    }
  },

  /**
   * update Plan
   */

  updateplan: async (req, res) => {
    try {
      const body = req.body;
      const id = body.id;
      if (!id) {
        return res.status(404).json({
          status: 404,
          success: false,
          error: { code: 404, message: constants.COMMON.PAYLOAD_MISSING },
        });
      }
      delete body.id;
      delete body.pricing;
      // Sync offMarket boolean from otherDetails.accessToOffMarketProps
      if (body.otherDetails?.accessToOffMarketProps?.key !== undefined) {
        body.offMarket = body.otherDetails.accessToOffMarketProps.key !== 'not_available';
      }
      let updated = await db.plans.updateOne({ _id: id }, { $set: body });
      if (updated.matchedCount === 0) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: constants.PLAN.NOT_FOUND,
        });
      }
      return res.status(200).json({
        status: 200,
        success: true,
        message: constants.PLAN.UPDATED,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        status: 400,
        success: false,
        error: { status: 400, message: "" + err },
      });
    }
  },

  /**
   * Delete plan
   */
  delete_plan: async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) {
        return res.status(404).json({
          status: 404,
          jsonBody: {
            success: false,
            error: { code: 404, message: constants.COMMON.PAYLOAD_MISSING },
          },
        });
      }
      let updated = await db.plans.updateOne(
        { _id: id },
        { $set: { isDeleted: true } }
      );
      if (updated.matchedCount === 0) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: constants.PLAN.NOT_FOUND,
        });
      }
      return res.status(200).json({
        status: 200,
        success: true,
        message: constants.PLAN.DELETED,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
      });
    }
  },
  /**
   * statusChange
   */

  statusChange: async (req, res) => {
    try {
      const body = req.body;
      const id = body.id;
      if (!id && !body.status) {
        return res.status(404).json({
          status: 404,
          success: false,
          error: { code: 404, message: constants.COMMON.PAYLOAD_MISSING },
        });
      }
      delete body.id;
      let updated = await db.plans.updateOne(
        { _id: id },
        { $set: { status: body.status } }
      );
      if (updated.matchedCount === 0) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: constants.PLAN.NOT_FOUND,
        });
      }
      return res.status(200).json({
        status: 200,
        success: true,
        message: constants.PLAN.STATUS_CHANGED,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        status: 400,
        success: false,
        error: { status: 400, message: "" + err },
      });
    }
  },
};
