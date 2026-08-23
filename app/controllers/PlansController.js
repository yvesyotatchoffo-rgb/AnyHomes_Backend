const db = require("../models");
const constants = require("../utls/constants");
var mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const stripe = process.env.STRIPE_KEY ? require("stripe")(process.env.STRIPE_KEY) : null;

/**
 * Applied la réduction annuelle (annualDiscount) sur le pricing :
 * le prix annuel est recalculé comme 12 × prix mensuel × (1 - réduction/100).
 */
function applyAnnualDiscount(pricing, discount) {
  if (!Array.isArray(pricing)) return pricing;
  const monthly = pricing.find((p) => p.interval === "month");
  const annual = pricing.find((p) => p.interval === "year");
  const pct = Number(discount);
  if (monthly && annual && !isNaN(pct)) {
    annual.unit_amount = Math.round(Number(monthly.unit_amount) * 12 * (1 - pct / 100));
    annual.currency = annual.currency || monthly.currency;
    annual.interval = "year";
    annual.interval_count = annual.interval_count || 1;
  }
  return pricing;
}

/**
 * Crée les prix Stripe pour le pricing d'un plan et renvoie le pricing enrichi
 * de `stripe_price_id`. `productId` est réutilisé s'il existe.
 */
async function createStripePrices(pricing, productId) {
  if (!stripe) return pricing;
  for (const itm of pricing) {
    const stripePrice = await stripe.prices.create({
      product: productId,
      unit_amount: Math.round(Number(itm.unit_amount) * 100),
      currency: itm.currency,
      recurring: {
        interval: itm.interval ? itm.interval : "month",
        interval_count: itm.interval_count ? itm.interval_count : 1,
      },
    });
    itm.stripe_price_id = stripePrice.id;
  }
  return pricing;
}

/** Récupère (ou crée) le Stripe product d'un plan existant. */
async function getOrCreateProduct(plan) {
  if (!stripe) return null;
  const prevPriceId = plan?.pricing?.[0]?.stripe_price_id;
  if (prevPriceId) {
    try {
      const prev = await stripe.prices.retrieve(prevPriceId);
      if (prev?.product) return prev.product;
    } catch (e) { /* ignore */ }
  }
  const product = await stripe.products.create({ name: plan?.name || "plan" });
  return product.id;
}

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
        let pricing = applyAnnualDiscount(body.pricing, body.annualDiscount);
        body.pricing = pricing;
        if (stripe && Array.isArray(pricing) && pricing.length) {
          const product = await stripe.products.create({
            name: body.name,
          });
          body.stripe_product_id = product.id;
          pricing = await createStripePrices(pricing, product.id);
          body.pricing = pricing;
        }
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
            annualDiscount: "$annualDiscount",
            planType: "$planType",
            userType: "$userType",
            whiteLabelEnabled: "$whiteLabelEnabled",
            whiteLabelMaxLeads: "$whiteLabelMaxLeads",
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
   * Duplique un plan : même contenu, nom + " Copie", statut inactif.
   */
  duplicatePlan: async (req, res) => {
    try {
      const id = req.body.id;
      if (!id) {
        return res.status(404).json({
          status: 404,
          success: false,
          error: { code: 404, message: constants.COMMON.PAYLOAD_MISSING },
        });
      }
      const original = await db.plans.findOne({ _id: id, isDeleted: false });
      if (!original) {
        return res.status(404).json({
          status: 404,
          success: false,
          error: { code: 404, message: constants.PLAN.NOT_FOUND },
        });
      }

      // Nom : "<original> Copie", puis "<original> Copie (2)"… si déjà pris.
      const base = `${original.name} Copie`.toLowerCase().trim();
      let name = base;
      let n = 2;
      while (await db.plans.findOne({ name, isDeleted: false })) {
        name = `${base} ${n}`;
        n += 1;
      }

      const doc = original.toObject();
      delete doc._id;
      delete doc.__v;
      delete doc.createdAt;
      delete doc.updatedAt;
      delete doc.isDeleted;
      delete doc.status;

      let pricing = (original.pricing || []).map((p) => ({
        unit_amount: p.unit_amount,
        currency: p.currency,
        interval: p.interval,
        interval_count: p.interval_count,
      }));

      doc.name = name;
      doc.status = "deactive"; // statut Inactif
      doc.isDeleted = false;
      doc.userType = original.userType || "individual";
      doc.addedBy = new ObjectId(req.identity.id);
      doc.createdAt = new Date();
      doc.updatedAt = new Date();
      doc.pricing = pricing;

      if (stripe && pricing.length) {
        const productId = await getOrCreateProduct(original);
        doc.pricing = await createStripePrices(pricing, productId);
      }

      const planAdded = await db.plans.create(doc);
      return res.status(200).json({
        status: 200,
        success: true,
        message: constants.PLAN.CREATED,
        data: planAdded,
      });
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
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

      let pricing = body.pricing;
      if (Array.isArray(pricing)) {
        pricing = applyAnnualDiscount(pricing, body.annualDiscount);
        body.pricing = pricing;
        if (stripe) {
          const existing = await db.plans.findById(id);
          const productId = await getOrCreateProduct(existing);
          if (productId) {
            pricing = await createStripePrices(pricing, productId);
            body.pricing = pricing;
          }
        }
      } else {
        delete body.pricing;
      }

      // Sync offMarket boolean from otherDetails.accessToOffMarketProps
      if (body.otherDetails?.accessToOffMarketProps?.key !== undefined) {
        body.offMarket = body.otherDetails.accessToOffMarketProps.key !== 'not_available';
      }
      body.updatedAt = new Date();
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
