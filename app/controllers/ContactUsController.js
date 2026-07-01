const db = require("../models");
const constants = require("../utls/constants");
const Emails = require("../Emails/onBoarding");
const { sendEmail } = require("../config/brevo.config");
var mongoose = require("mongoose");
const fcm_service = require("../services/FcmServices");


module.exports = {
    contactUs: async (req, res) => {
        try {
            const data = req.body
            if (!data.email || !data.property_id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 400, message: constants.onBoarding.PAYLOAD_MISSING }
                })
            }
            data.addedBy = req.identity.id
            let find_property = await db.property.findOne({ _id: data.property_id })
            if (find_property) {
                let findUser = await db.users.findOne({ _id: find_property.addedBy })
                let email_payload = {
                    email: findUser.email,
                    fullName: findUser.fullName,
                    userName: req.body.firstName,
                    useremail: req.body.email
                }
                await sendEmail({
                    module: "AUTH",
                    to: findUser.email,
                    subject: "Nouvelle demande de contact sur AnyHomes",
                    templateId: constants.BREVO.CONTACT_US_NOTIFICATION,
                    params: {
                        fullName: findUser.fullName,
                        userName: req.body.firstName,
                        useremail: req.body.email,
                        appName: "AnyHomes",
                        logoUrl: `${process.env.BACK_WEB_URL}/img/logo.png`,
                    }
                });
            }

            const currUser = db.users.findOne({ _id: req.identity.id });
            let created = await db.contactUs.create(data)
            let notification_payload = {
                sendBy: req.identity.id,
                sendTo: find_property.addedBy,
                message: `${currUser.firstName || "new User"} Contact you for  property ${find_property.propertyTitle}`,
                title: "Property Notification",
                type: "contact-for-property",
                property_id: data.property_id,
            };
            let cretate_notification = await db.notifications.create(notification_payload)

            notification_payload.device_token = req.identity.deviceToken;
            fcm_service.send_fcm_push_notification(notification_payload);
            return res.status(200).json({
                success: true,
                message: "Contact request sent"
            })
        } catch (err) {
            console.log(err, "================err")
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err }
            })
        }
    },

    detail: async (req, res) => {
        try {
            let { id } = req.query;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 400, message: "Payload missing" }
                })
            }
            let query = {}
            query.isDeleted = false
            let detail = await db.contactUs.findOne({ _id: id, isDeleted: false }).populate("property_id")
            if (detail) {
                return res.status(200).json({
                    success: true,
                    data: detail
                });
            }
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err },
            });
        }
    },
    listing: async (req, res) => {
        try {
            const { search, page, count, sortBy, type, status, slug, property_id, addedBy } = req.query;
            var query = {};

            if (search) {
                query.$or = [
                    { fullName: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                ];
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
            if (type) {
                query.type = type;
            }

            if (slug) {
                query.slug = slug
            }
            if (property_id) {
                query.property_id = mongoose.Types.ObjectId.createFromHexString(property_id)
            }
            if (addedBy) {
                query.addedBy = mongoose.Types.ObjectId.createFromHexString(addedBy)

            }

            const pipeline = [
                {
                    $match: query,
                },
                {
                    $sort: sortquery,
                },
                {
                    $lookup: {
                        from: "properties",
                        localField: "property_id",
                        foreignField: "_id",
                        as: "propertyDetails"
                    }
                },
                {
                    $unwind: {
                        path: "$propertyDetails",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        id: "$_id",
                        firstName: "$firstName",
                        lastName: "$lastName",
                        email: "$email",
                        mobileNo: "$mobileNo",
                        type: "$type",
                        property_to_sell: "$property_to_sell",
                        not_want_to_receive_advices: "$not_want_to_receive_advices",
                        property_id: "$property_id",
                        propertyDetails: "$propertyDetails",
                        isDeleted: "$isDeleted",
                        addedBy: "$addedBy",
                        status: "$status",
                        createdAt: "$createdAt",
                        updatedAt: "$updatedAt",
                    },
                },
            ];

            const total = await db.contactUs.aggregate([...pipeline]);

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

            const result = await db.contactUs.aggregate([...pipeline]);

            return res.status(200).json({
                success: true,
                data: result,
                total: total.length,
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err },
            });
        }
    },
    delete: async (req, res) => {
        try {
            let { id } = req.query;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: { code: 400, message: "Payload missing" }
                })
            }
            let deleted = await db.contactUs.updateOne({ _id: id }, { isDeleted: true })
            if (deleted) {
                return res.status(200).json({
                    success: true,
                    message: "Data deleted"
                });
            }
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err },
            });
        }
    },
}