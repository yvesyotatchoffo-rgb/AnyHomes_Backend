const { isDate } = require("lodash");
const db = require("../models");
const { message } = require("../services");
const { success } = require("../services/Response");
const Timeline = db.timeline;
const Property = db.property;
const constants = require("../utls/constants");
const { detail } = require("./CategoriesController");
const { isReadable } = require("nodemailer/lib/xoauth2");

module.exports = {

    add: async (req, res) => {
        try {
            let { revenue_detail, propertyType, propertyId, price, propertyMonthlyCharges, proposal } = req.body;
            if (!propertyId) {
                return res.status(400).json({
                    success: false,
                    error: { code: 400, message: "Property ID is required" },
                });
            }

            let addedBy = req.identity.id;

            let findData = await Property.findOne({ _id: propertyId });
            if (!findData) {
                return res.status(404).json({
                    success: false,
                    error: { code: 404, message: "Property not found" }
                })
            }
            // let type;
            let dataToInsert = [];
            if (price !== undefined) {
                dataToInsert.push({
                    type: "newPrice",
                    propertyId,
                    addedBy,
                    oldPrice: findData.price,
                    newPrice: price
                })
            }
            if (propertyType !== undefined) {
                dataToInsert.push({
                    type: "propertyType",
                    propertyId,
                    addedBy,
                    propertyType,
                })
            }
            if (propertyMonthlyCharges !== undefined) {
                dataToInsert.push({
                    type: "propertyMonthlyCharges",
                    propertyId,
                    addedBy,
                    propertyMonthlyCharges,
                })
            }
            if (proposal !== undefined) {
                dataToInsert.push({
                    type: "proposal",
                    propertyId,
                    addedBy,
                    proposal,
                })
            }
            if (revenue_detail !== undefined) {
                dataToInsert.push({
                    type: "revenue_detail",
                    propertyId,
                    addedBy,
                    revenue_detail,
                })
            }
            // if (Object.keys(dataToInsert).length <= 2) { 
            //     return res.status(400).json({
            //         success: false,
            //         error: { code: 400, message: "No valid update fields provided" },
            //     });
            // }
            let created = await Timeline.create(dataToInsert);
            return res.status(200).json({
                success: true,
                message: "Data Created"
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err },
            });
        }
    },

    list: async (req, res) => {
        try {
            const {
                propertyType,
                propertyId,
                addedBy,
                page = 1,
                count = 10,
                sortField = 'createdAt',
                sortOrder = 'desc',
            } = req.query;

            const query = {};
            if (propertyType) query.propertyType = propertyType;
            if (propertyId) query.propertyId = propertyId;
            if (addedBy) query.addedBy = addedBy;

            const skip = (page - 1) * count;

            const timelines = await Timeline.find(query)
                // .populate('propertyId', 'price')
                // .populate('propertyId', 'name location price') 
                .populate('addedBy', 'username email')
                .sort({ [sortField]: sortOrder })
                .skip(skip)
                .limit(Number(count));
            const totalItems = await Timeline.countDocuments(query);

            return res.status(200).json({
                success: true,
                data: {
                    timelines,
                    pagination: {
                        totalItems,
                        // currentPage: Number(page),
                        // totalPages: Math.ceil(totalItems / limit),
                    },
                },
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + err },
            });
        }
    },


    statusChange: async (req, res) => {
        try {
            const { id, like } = req.body;
    
            if (!id || typeof like !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid request. 'id' and 'like' are required.",
                });
            }
    
            const timeline = await db.timeline.findOne({ _id: id });
            if (!timeline) {
                return res.status(404).json({
                    success: false,
                    message: "Timeline not found.",
                });
            }
    
            if (like === true) {
                if (timeline.like === false) {
                    timeline.like = true; 
                    timeline.likeCount = 1; 
                } else if (timeline.like === true) {
                    timeline.likeCount += 1; 
                }
            }
            else if (like === false) {
                if (timeline.likeCount > 1) {
                    timeline.likeCount -= 1;
                } else if (timeline.likeCount === 1) {
                    timeline.like = false; 
                    timeline.likeCount = 0; 
                }
            }
    
          let data =  await timeline.save();
    
            return res.status(200).json({
                success: true,
                message: "Like status updated successfully.",
                data: {
                    like: data.like,
                    likeCount: data.likeCount
                },
            });
        }
        catch(err) {
        return res.status(500).json({
            success: false,
            error: { code: 500, message: "" + err },
        });
    }
}
}
