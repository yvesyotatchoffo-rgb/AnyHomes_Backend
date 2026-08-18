const db = require("../models");
const Notifications = db.notifications;
const fcm_service = require("../services/FcmServices");
const ObjectId = require('mongodb').ObjectId;

module.exports = {
  notifications: async (req, res) => {
    try {
      let {
        search,
        sortBy,
        page,
        count,
        status,
        sendById,
        sendToId

      } = req.query;
      let query = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { message: { $regex: search, $options: "i" } },
        ];
      }

      query.isDeleted = false;

      if (status) {
        query.status = status;
      }
      if (sendById) {
        query.sendById = new ObjectId(sendById)

      }
      if (sendToId) {
        query.sendToId = new ObjectId(sendToId)

      }


      let sortquery = {};
      if (sortBy) {
        let [field, sortType] = sortBy.split(" ");
        sortquery[field ? field : "createdAt"] =
          sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1;
      }
      console.log(query, "============")
      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "sendTo",
            foreignField: "_id",
            as: "sendToDetails",
          },
        },
        {
          $unwind: {
            path: "$sendToDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "properties",
            localField: "property_id",
            foreignField: "_id",
            as: "propertyDetails",
          },
        },
        {
          $unwind: {
            path: "$propertyDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "sendBy",
            foreignField: "_id",
            as: "sendByDetails",
          },
        },
        {
          $unwind: {
            path: "$sendByDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            id: "$_id",
            status: "$status",
            sendBy: "$sendByDetails",
            sendById: "$sendByDetails._id",
            sendTo: "$sendToDetails",
            sendToId: "$sendToDetails._id",
            type: "$type",
            message: "$message",
            title: "$title",
            interestId: "$interestId",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            isDeleted: "$isDeleted",
            image: "$sendByDetails.image",
            propertyDetails:"$propertyDetails"
          },
        },
        { $match: query },
        { $sort: sortquery },
      ];

      const total = await Notifications.aggregate([...pipeline]);
      // console.log(total,"=========total")

      if (page && count) {
        let skipNo = (Number(page) - 1) * Number(count);
        pipeline.push(
          { $skip: Number(skipNo) },
          { $limit: Number(count) }
        );
      }

      const result = await Notifications.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + error,
        },
      });
    }
  },
  send_message: async (req, res) => {
    try {
      let message = req.body.message;
      if (!message) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: "message is required" },
        });
      }
      let notification_payload = {
        sendBy: req.identity.id,
        sendTo: req.body.sendTo,
        message: message,
        title: "Message Notification",
        type: "Message",
      };
      let create_notification = await db.notifications.create(notification_payload)
      if (create_notification) {
        let users = await db.users.findOne({ _id: req.body.sendTo })
        notification_payload.device_token = users.deviceToken;
        let fcm_response = await fcm_service.send_fcm_push_notification(notification_payload);
        // console.log(fcm_response, '"=============fcm_response')
        if (fcm_response) {
          return res.status(200).json({
            success: true,
            message: "Message sent to user successfully",
          });
        } else {
          return res.status(500).json({
            success: false,
            message: "Failed to send push notification",
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to create notification in the database",
        });
      }

    } catch (error) {
      console.log(error)
      return res.status(400).json({
        success: false,
        code: 400,
        message: error,
      });
    }

  },
  change_status: async (req, res) => {
    try {
      let data = req.body
      if (!data.id) {
        return res.status(400).json({
          success: false,
          message: "Id is required"
        })
      }
      let update_notification = await db.notifications.updateOne({ _id: req.body.id }, { status: req.body.status })
      let all_unread_notification = await db.notifications.countDocuments({
        sendTo: data.sendTo,
        isDeleted: false,
        status: "unread",
      });
      await db.users.updateOne(
        { _id: data.sendTo },
        { unread_notifications_count: all_unread_notification }
      );
      return res.status(200).json({
        success: true,
        message: "data updated"
      })

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + error,
        },
      });
    }

  },
  change_status_multiple: async (req, res) => {
    try {
      let data = req.body
      if (!data.ids) {
        return res.status(400).json({
          success: false,
          message: "Ids are is required"
        })
      }
      for (let itm of data.ids) {
        let update_notification = await db.notifications.updateOne({ _id: itm }, { status: req.body.status })
      }
      let all_unread_notification = await db.notifications.countDocuments({
        sendTo: data.sendTo,
        isDeleted: false,
        status: "unread",
      });
      await db.users.updateOne(
        { _id: data.sendTo },
        { unread_notifications_count: all_unread_notification }
      );
      return res.status(200).json({
        success: true,
        message: "data updated"
      })

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + error,
        },
      });
    }

  },
  delete: async (req, res) => {
    try {
      let data = req.query
      if (!data.id) {
        return res.status(400).json({
          success: false,
          message: "Id is required"
        })
      }
      let delete_notification = await db.notifications.updateOne({ _id: req.query.id }, { isDeleted: true })
      let all_unread_notification = await db.notifications.countDocuments({
        sendTo: data.sendTo,
        isDeleted: false,
        status: "unread",
      });
      await db.users.updateOne(
        { _id: data.sendTo },
        { unread_notifications_count: all_unread_notification }
      );
      return res.status(200).json({
        success: true,
        message: "data deleted"
      })

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + error,
        },
      });
    }

  },

}