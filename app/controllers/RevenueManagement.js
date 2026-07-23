const db = require("../models");
const constants = require("../utls/constants");
const Revenue = db.revenue;
var mongoose = require("mongoose");

module.exports = {
    add: async (req, res) => {
        try {
            let data = req.body;
            let name = data.name;
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Payload missing",
                });
            }
            let revenuedata = await Revenue.findOne({ name: name, isDeleted: false, type: data.type || "Ratings" });
            if (!revenuedata) {
                data.addedBy = req.identity.id;
                const createRevenue = await Revenue.create(data);
                return res.status(200).json({
                    success: true,
                    message: "Data added"
                })
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Data already exist"
                });
            }
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


    revenueDetails: async (req, res) => {
        try {
            let id = req.query.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            }
            let RevenueData = await Revenue.findOne({ _id: id, isDeleted: false });
            if (RevenueData) {
                return res.status(200).json({
                    success: true,
                    data: RevenueData,
                })
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Data not found"
                })
            }
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

    editrevenue: async (req, res) => {
        try {
            let data = req.body;
            if (!data.id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            }
            await Revenue.updateOne({ _id: data.id }, data)
            return res.status(200).json({
                success: true,
                message: "Data updated"
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
    statusChange: async (req, res) => {
        try {
            let id = req.body.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            } else {
                let findBlog = await Blogs.findOne({ _id: id });
                if (findBlog) {
                    if (findBlog.status == "active") {
                        await Blogs.updateOne({ _id: id }, { status: "deactive" })
                    } else {
                        await Blogs.updateOne({ _id: id }, { status: "active" })
                    }
                    return res.status(200).json({
                        success: true,
                        message: constants.BLOG.STATUS_CHANGED
                    })
                } else {
                    return res.status(400).json({
                        success: false,
                        message: constants.BLOG.NOT_FOUND
                    })
                }
            }
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
    deleteRevenue: async (req, res) => {
        try {
            let id = req.query.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            }
            let findRevenue = await Revenue.findOne({ _id: id, isDeleted: false });
            if (findRevenue) {
                await Revenue.updateOne({ _id: id }, { isDeleted: true })
                return res.status(200).json({
                    success: true,
                    message: "Data deleted"
                })
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Id is invalid"
                })
            }

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
    listing: async (req, res) => {
        try {
            const { search, page, count, sortBy, type, status, revenueType } = req.query;
            var query = {};
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } },
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
                query.type = type
            }
            if(revenueType){
                query.revenueType = new mongoose.Types.ObjectId(revenueType);
            }
            const pipeline = [
                {
                    $match: query,
                },
                {
                    $sort: sortquery,
                },

                {
                    $project: {
                        id: "$_id",
                        name: "$name",
                        type: "$type",
                        image: "$image",
                        status: "$status",
                        banner: 1,
                        metaTitle: 1,
                        metaDesciption: 1,
                        createdAt: "$createdAt",
                        updatedAt: "$updatedAt",
                        isDeleted: "$isDeleted",
                        addedBy: "$addedBy",
                        revenueType: "$revenueType"
                    },
                },
            ];
            const total = await Revenue.countDocuments(query);
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
            const result = await Revenue.aggregate([...pipeline]);

            return res.status(200).json({
                success: true,
                data: result,
                total: total,
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
}