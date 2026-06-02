const db = require("../models");
const constants = require("../utls/constants");
const followUnfollow = db.followUnfollow;
const fcm_service = require("../services/FcmServices");
const Favorites = db.favorites;

module.exports = {
  listFollowedProperties: async (req, res) => {
    try {
      const userId = req.query.userId || req.identity?.id;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId required',
        });
      }

      const query = {
        isDeleted: false,
        user_id: userId,
        follow_unfollow: true,
      };

      const [records, total] = await Promise.all([
        db.followUnfollow
          .find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate({
            path: 'property_id',
            select: 'propertyTitle address city zipcode propertyType images price propertyMonthlyCharges addedBy',
            populate: {
              path: 'addedBy',
              select: 'fullName firstName lastName email',
            },
          })
          .populate('campaignId', 'campaignName status startDate endDate')
          .lean(),
        db.followUnfollow.countDocuments(query),
      ]);

      const data = records.map((item) => ({
        id: item._id,
        followUnfollowId: item._id,
        property: item.property_id || null,
        campaign: item.campaignId || null,
        p2pFollow: item.p2pFollow,
        followUnfollow: item.follow_unfollow,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

      return res.status(200).json({
        success: true,
        data,
        pagination: { page, limit, total },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: '' + error,
        },
      });
    }
  },

  addfollowUnfollow: async (req, res) => {
    try {
      let data = req.body;
      if (!data.property_id || !data.user_id) {
        return res.status(400).json({
          success: false,
          message: constants.FOLLOW_UNFOLLOW.PAYLOAD_MISSING,
        });
      }
      data.addedBy = req.identity.id;
      if (data.p2pFollow === true) {
        const currentCampaign = await db.peerCampaign.findOne(
          {
            propertyId: data.property_id,
            status: "active"
          })
        if (currentCampaign) {
          data.campaignId = currentCampaign._id;
        } else {
          data.campaignId = null;
        }
      }
      const create = await db.followUnfollow.create(data);
      return res.status(200).json({
        success: true,
        message: constants.FOLLOW_UNFOLLOW.CREATED,
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

  editFollowUnfollow: async (req, res) => {
    try {
      let data = req.body;
      if (!data.user_id || !data.property_id) {
        return res.status(404).json({
          success: false,
          error: { code: 404, message: constants.onBoarding.PAYLOAD_MISSING },
        });
      }
      if (!data.id) {
        let query = {
          isDeleted: false,
          user_id: data.user_id,
          property_id: data.property_id,
        };
        let existed = await db.followUnfollow
          .findOne(query)
          .populate("property_id");

        if (existed) {
          if (data.follow_unfollow === true && data.p2pFollow === true) {
            const currentCampaign = await db.peerCampaign.findOne(
              {
                propertyId: data.property_id,
                status: "active"
              })
            if (currentCampaign) {
              data.campaignId = currentCampaign._id;
            } else {
              data.campaignId = null;
            }
          }
          let updated = await db.followUnfollow.updateOne(
            { _id: existed.id },
            data
          );
          let propertyOwnerId = await db.property.findOne({ _id: data.property_id });
          let user_id = await db.setting.findOne({ user_id: propertyOwnerId.addedBy });
          if (user_id.new_follow.phone === true) {
            let notification_payload = {
              sendBy: req.identity.id,
              sendTo: existed.property_id.addedBy,
              message: `${req.identity.firstName || "new user"} followed your property.`,
              title: `${existed.property_id.propertyTitle}`,
              type: "Property",
              property_id: existed.property_id._id,
            };
            let create_notification = await db.notifications.create(
              notification_payload
            );
            notification_payload.device_token = req.identity.deviceToken;
            fcm_service.send_fcm_push_notification(notification_payload);
          }

          return res.status(200).json({
            success: true,
            message: constants.FOLLOW_UNFOLLOW.UPDATED,
          });
        } else {

          if (data.follow_unfollow === true && data.p2pFollow === true) {
            const currentCampaign = await db.peerCampaign.findOne(
              {
                propertyId: data.property_id,
                status: "active"
              })
            if (currentCampaign) {
              data.campaignId = currentCampaign._id;
            } else {
              data.campaignId = null;
            }
          }
          let created = await db.followUnfollow.create(data);
          let existedNewOne = await db.followUnfollow
            .findOne({
              _id: created._id,
            })
            .populate("property_id");
          let propertyOwnerId = await db.property.findOne({ _id: data.property_id });
          let user_id = await db.setting.findOne({ user_id: propertyOwnerId.addedBy });
          if (user_id.new_follow.phone === true) {
            let notification_payload = {
              sendBy: req.identity.id,
              sendTo: existedNewOne.property_id.addedBy,
              message: `${req.identity.firstName || "new user"} follow your property ${existedNewOne.property_id.propertyTitle}`,
              title: `${existedNewOne.property_id.name}`,
              type: "Property",
              property_id: existedNewOne.property_id._id,
            };
            let create_notification = await db.notifications.create(
              notification_payload
            );
            notification_payload.device_token = req.identity.deviceToken;
            fcm_service.send_fcm_push_notification(notification_payload);
          }
          return res.status(200).json({
            success: true,
            message: constants.FOLLOW_UNFOLLOW.UPDATED,
          });
        }
      }

      if (data.p2pFollow === true) {
        const currentCampaign = await db.peerCampaign.findOne(
          {
            propertyId: data.property_id,
            status: "active"
          })
        if (currentCampaign) {
          data.campaignId = currentCampaign._id;
        } else {
          data.campaignId = null;
        }
      }

      let updated = await db.followUnfollow.updateOne({ _id: data.id }, data);
      return res.status(200).json({
        success: true,
        message: constants.FOLLOW_UNFOLLOW.UPDATED,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + error,
        },
      });
    }
  },
};
