const db = require("../models");
const Amenities = db.amenities;
let mongoose = require("mongoose");
const constants = require("../utls/constants");
const { captureRejectionSymbol } = require("nodemailer/lib/xoauth2");

module.exports = {
  add: async (req, res) => {
    try {
      const data = req.body;
      if (!data.amenities) {
        return res.status(400).json({
          success: false,
          message: constants.AMENITIES.PAYLOAD_MISSING,
        });
      }
      for (let itm of data.amenities) {

        const existing = await Amenities.findOne({
          title: itm.title,
          isDeleted: false,
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            error: { code: 400, message: constants.AMENITIES.ALREADY_EXIST },
          });
        }
        itm.addedBy = req.identity.id;
        const created = await db.amenities.create(itm);
      }
      return res.status(200).json({
        success: true,
        message: constants.AMENITIES.CREATED,
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        error: { code: 500, message: "" + error },
      });
    }
  },
  detail: async (req, res) => {
    try {
      let { id } = req.query;
      if (!id) {
        return res.status(404).json({
          success: false,
          code: 400,
          error: { code: 400, message: constants.AMENITIES.ID_MISSING },
        });
      }
      let detail = await Amenities.findOne({ _id: id }).populate('categoryId');
      return res.status(200).json({
        success: true,
        data: detail,
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        error: { code: 500, message: "" + error },
      });
    }
  },

  update: async (req, res) => {
    try {
      let data = req.body;
      let id = req.body.id;
      if (!id) {
        return res.status(404).send({
          success: false,
          message: constants.AMENITIES.ID_MISSING,
        });
      }
      let existed = await Amenities.findOne({ _id: id });
      if (!existed) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: constants.AMENITIES.NOT_EXIST },
        });
      }
      let query = {};
      query.isDeleted = false;
      query._id = { $ne: id };
      if (data.title) {
        query.title = data.title;
        const existing = await Amenities.findOne(query);

        if (existing) {
          return res.status(400).json({
            success: false,
            error: { code: 400, message: constants.AMENITIES.ALREADY_EXIST },
          });
        }
      }

      await Amenities.updateOne({ _id: id }, data);
      return res.status(200).send({
        success: true,
        message: constants.AMENITIES.UPDATED,
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        error: { code: 500, message: "" + error },
      });
    }
  },

  delete: async (req, res) => {
    try {
      let id = req.query.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { code: 404, message: constants.AMENITIES.ID_MISSING },
        });
      }
      await Amenities.updateOne({ _id: id }, { $set: { isDeleted: true } });
      return res.status(200).json({
        success: true,
        message: constants.AMENITIES.DELETED,
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        error: { code: 500, message: "" + error },
      });
    }
  },

  listing: async (req, res) => {
    try {
      const { search, page, count, sortBy, status, categoryId, lang } = req.query;
      var query = {};

      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }
      if (categoryId) {
        query.categoryId = new mongoose.Types.ObjectId(categoryId);
      }
      query.isDeleted = false;
      var sortquery = {};
      if (sortBy) {
        var order = sortBy.split(" ");
        var field = order[0];
        var sortType = order[1];
      }

      sortquery[field ? field : "createdAt"] = sortType
        ? sortType == "desc"
          ? -1
          : 1
        : -1;
      if (status) {
        query.status = status;
      }
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "categoryId"
          }
        },
        {
          $unwind: {
            path: "$categoryId",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $sort: sortquery,
        },

        {
          $project: {
            id: "$_id",
            title: { $toLower: "$title" },
            title_en: 1,
            description: "$description",
            image: "$image",
            status: "$status",
            status: "$status",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            isDeleted: "$isDeleted",
            addedBy: "$addedBy",
            categoryId: "$categoryId"
          },
        },
      ];
      const total = await Amenities.countDocuments(query);
      if (page && count) {
        var skipNo = (Number(page) - 1) * Number(count);

        pipeline.push(
          {
            $skip: Number(skipNo),
          },
          {
            $limit: Number(count),
          }
        );
      }
      const result = await Amenities.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: { code: 500, message: "" + err },
      });
    }
  },
  changeStatus: async (req, res) => {
    try {
      let data = req.body;
      let id = req.body.id;
      let status = req.body.status;
      if (!id) {
        return res.status(404).send({
          success: false,
          message: constants.AMENITIES.ID_MISSING,
        });
      }
      let exist = await Amenities.findOne({ _id: id });
      if (!exist) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: constants.AMENITIES.NOT_EXIST },
        });
      }

      let updateblog = await Amenities.updateOne(
        { _id: id },
        { $set: { status: status } }
      );
      return res.status(200).send({
        success: true,
        message: constants.COMMON.STATUS_CHANGED,
      });
    } catch (error) {
      return res.status(500).json({
        code: 500,
        error: { code: 500, message: "" + error },
      });
    }
  },
};
