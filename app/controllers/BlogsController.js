const { default: mongoose } = require("mongoose");
const db = require("../models");
const constants = require("../utls/constants");
const Blogs = db.blogs;


module.exports = {
    addBlogs: async (req, res) => {
        try {
            let data = req.body;
            let title = data.title;
            if (!data.title || !data.categoryId || !data.subCategoryId) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.PAYLOAD_MISSING,
                });
            }
            let blogsData = await Blogs.findOne({ title: title, isDeleted: false });

            const findPersona = await db.persona.findOne({ _id: data.categoryId, isDeleted: false });
            if (!findPersona) {
                return res.status(400).json({
                    success: false,
                    message: "Persona not found."
                });
            }

            const TrainingTopic = require('../models/trainingTopic.model');
            const findTopic = await TrainingTopic.findOne({ _id: data.subCategoryId, isDeleted: false });
            if (!findTopic) {
                return res.status(400).json({
                    success: false,
                    message: "Training topic not found."
                });
            }

            if (!blogsData) {
                data.addedBy = req.identity.id;
                const createBlog = await Blogs.create(data);
                return res.status(200).json({
                    success: true,
                    message: constants.BLOG.CREATED
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ALREADY_EXIST,
                });
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


    blogDetails: async (req, res) => {
        try {
            const { id, loggedinUser } = req.query;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            }
            const TrainingTopic = require('../models/trainingTopic.model');
            let blogRaw = await Blogs.findOne({ _id: id, isDeleted: false }).populate('blogOwner', 'fullName email image');
            if (!blogRaw) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.NOT_FOUND
                });
            }
            // Populate persona and training topic manually
            let blogData = blogRaw.toObject();
            // blogOwner is populated by .populate() → expose as blogOwnerData for consistency with listing endpoint
            blogData.blogOwnerData = blogData.blogOwner || null;
            if (blogData.categoryId) {
                const persona = await db.persona.findOne({ _id: blogData.categoryId });
                blogData.personaData = persona || null;
                blogData.personaName = persona?.name || null;
            }
            if (blogData.subCategoryId) {
                const topic = await TrainingTopic.findOne({ _id: blogData.subCategoryId });
                blogData.topicData = topic ? topic.toJSON() : null;
                blogData.topicName = topic?.name || null;
            }

            const contentLikeCount = Array.isArray(blogData.contentLike) ? blogData.contentLike.length : 0;
            const contentDislikeCount = Array.isArray(blogData.contentDislike) ? blogData.contentDislike.length : 0;

            const userId = loggedinUser ? loggedinUser.toString() : null;

            const isLikedByUser = userId
                ? blogData.contentLike?.some((id) => id.toString() === userId)
                : false;

            const isDislikedByUser = userId
                ? blogData.contentDislike?.some((id) => id.toString() === userId)
                : false;

            return res.status(200).json({
                success: true,
                data: {
                    ...blogData,
                    contentLikeCount,
                    contentDislikeCount,
                    isLikedByUser,
                    isDislikedByUser
                },
                message: constants.BLOG.RETRIEVED
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

    editBlogs: async (req, res) => {
        try {
            const { id, contentLike, contentDislike, loggedinUser, title, description, categoryId, subCategoryId, banner, metaTitle, images, blogOwner, duration } = req.body;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                });
            }

            const updateQuery = {};

            // Handle likes/dislikes
            if (contentLike === true) {
                updateQuery.$addToSet = { contentLike: loggedinUser };
                updateQuery.$pull = { contentDislike: loggedinUser };
            } else if (contentLike === false) {
                updateQuery.$pull = { contentLike: loggedinUser };
            }
            if (contentDislike === true) {
                updateQuery.$addToSet = { contentDislike: loggedinUser };
                updateQuery.$pull = { ...updateQuery.$pull, contentLike: loggedinUser };
            } else if (contentDislike === false) {
                updateQuery.$pull = { ...updateQuery.$pull, contentDislike: loggedinUser };
            }

            // Handle content fields
            const $set = {};
            if (title !== undefined) $set.title = title;
            if (description !== undefined) $set.description = description;
            if (categoryId !== undefined) $set.categoryId = categoryId;
            if (subCategoryId !== undefined) $set.subCategoryId = subCategoryId;
            if (banner !== undefined) $set.banner = banner;
            if (metaTitle !== undefined) $set.metaTitle = metaTitle;
            if (images !== undefined) $set.images = images;
            if (blogOwner !== undefined) $set.blogOwner = blogOwner;
            if (duration !== undefined) $set.duration = duration;

            if (Object.keys($set).length > 0) {
                updateQuery.$set = $set;
            }

            await Blogs.updateOne({ _id: id }, updateQuery);

            return res.status(200).json({
                success: true,
                message: constants.BLOG.UPDATED
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
    deleteBlog: async (req, res) => {
        try {
            let id = req.query.id;
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.ID_MISSING
                })
            }
            let findBlog = await Blogs.findOne({ _id: id, isDeleted: false });
            if (findBlog) {
                await Blogs.updateOne({ _id: id }, { isDeleted: true })
                return res.status(200).json({
                    success: true,
                    message: constants.BLOG.DELETED
                })
            } else {
                return res.status(400).json({
                    success: false,
                    message: constants.BLOG.NOT_FOUND
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
    listing: async (req, res) => {
        try {
            const { search, page, count, sortBy, status, categoryId, subCategoryId, blogOwner, loggedinUser } = req.query;
            var query = {};
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    // { description: { $regex: search, $options: "i" } },
                    { "personaData.name": { $regex: search, $options: "i" } },
                    { "topicData.name": { $regex: search, $options: "i" } }
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
            if (categoryId) {
                query.categoryId = new mongoose.Types.ObjectId(categoryId);
            }
            if (subCategoryId) {
                query.subCategoryId = new mongoose.Types.ObjectId(subCategoryId);
            }

            if (blogOwner) {
                query.blogOwner = new mongoose.Types.ObjectId(blogOwner);
            }
            const pipeline = [
                {
                    $lookup: {
                        from: "personas",
                        localField: "categoryId",
                        foreignField: "_id",
                        as: "personaData",
                    },
                },
                { $unwind: { path: "$personaData", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "trainingtopics",
                        localField: "subCategoryId",
                        foreignField: "_id",
                        as: "topicData",
                    },
                },
                { $unwind: { path: "$topicData", preserveNullAndEmptyArrays: true } },

                {
                    $lookup: {
                        from: "users",
                        localField: "blogOwner",
                        foreignField: "_id",
                        as: "blogOwnerData",
                    },
                },
                { $unwind: { path: "$blogOwnerData", preserveNullAndEmptyArrays: true } },
                {
                    $match: query,
                },
                {
                    $sort: sortquery,
                },
                {
                    $project: {
                        id: "$_id",
                        title: "$title",
                        title_fr: "$title_fr",
                        description: "$description",
                        description_fr: "$description_fr",
                        images: "$images",
                        status: "$status",
                        banner: 1,
                        metaTitle: 1,
                        metaDesciption: 1,
                        createdAt: "$createdAt",
                        updatedAt: "$updatedAt",
                        isDeleted: "$isDeleted",
                        addedBy: "$addedBy",
                        subCategoryId: 1,
                        categoryId: 1,
                        blogOwner: 1,
                        duration: 1,
                        personaName: "$personaData.name",
                        topicName: "$topicData.name",
                        personaData: "$personaData",
                        topicData: "$topicData",
                        blogOwnerData: "$blogOwnerData",
                        contentLikeCount: { $size: { $ifNull: ["$contentLike", []] } },
                        contentDislikeCount: { $size: { $ifNull: ["$contentDislike", []] } },
                        viewCount: { $ifNull: ["$viewCount", 0] },
                        personaKey: { $ifNull: ["$personaData.key", ""] },
                        isLikedByUser: {
                            $cond: {
                                if: {
                                    $in: [
                                        new mongoose.Types.ObjectId(loggedinUser),
                                        { $ifNull: ["$contentLike", []] }
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        },
                        isDislikedByUser: {
                            $cond: {
                                if: {
                                    $in: [
                                        new mongoose.Types.ObjectId(loggedinUser),
                                        { $ifNull: ["$contentDislike", []] }
                                    ]
                                },
                                then: true,
                                else: false
                            }
                        }
                    },
                },
            ];
            const total = await Blogs.countDocuments(query);
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
            const result = await Blogs.aggregate([...pipeline]);

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

    incrementView: async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) {
                return res.status(400).json({ success: false, message: "Blog id is required" });
            }
            const blog = await Blogs.findByIdAndUpdate(
                id,
                { $inc: { viewCount: 1 } },
                { new: true }
            );
            if (!blog) {
                return res.status(404).json({ success: false, message: "Blog not found" });
            }
            return res.status(200).json({ success: true, viewCount: blog.viewCount });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: { code: 500, message: "" + error },
            });
        }
    },
}