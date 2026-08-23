const db = require("../models");
const { message } = require("../services");
const { success } = require("../services/Response");
const constants = require("../utls/constants");
const mongoose = require("mongoose");

// Validate that type matches an existing persona
const validatePersonaType = async (type) => {
  try {
    const persona = await db.persona.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(type) ? new mongoose.Types.ObjectId(type) : null },
        { name: type }
      ],
      isActive: true,
      isDeleted: false
    });
    return persona !== null;
  } catch (error) {
    console.error("Error validating persona type:", error);
    return false;
  }
};

module.exports = {
  addFunnelUrl: async (req, res) => {
    try {
      const { funnelStatus, title, description, youtubeUrl, type, image, tags, videoOwner, topic, duration, isFunnel } = req.body;
      const trimmedFunnelStatus = funnelStatus?.trim();
      const addedBy = req.identity.id;
      const isFunnelVideo = isFunnel === true || isFunnel === 'true';
      if (!youtubeUrl || !title || !tags || !image || !type || !topic || (isFunnelVideo && !funnelStatus)) {
        return res.status(400).json({
          success: false,
          message: "Required fields missing.",
        })
      }
      
      // Validate that type corresponds to an existing persona
      const isValidPersona = await validatePersonaType(type);
      if (!isValidPersona) {
        return res.status(400).json({
          success: false,
          message: `Invalid persona type: ${type}. Please select a valid persona.`
        })
      }
      
      if (trimmedFunnelStatus) {
        const findStatus = await db.funnelUrl.findOne({ funnelStatus: trimmedFunnelStatus, status: "active" });
        if (findStatus) {
          return res.status(400).json({
            success: false,
            message: `Cannot add new link for status:${funnelStatus}.`
          })
        }
      }
      const create = await db.funnelUrl.create({ funnelStatus: trimmedFunnelStatus, title, youtubeUrl, addedBy, type, image, tags, videoOwner, topic, description, duration });
      return res.status(200).json({
        success: true,
        message: `New Link added for status:${funnelStatus}.`
      })

    } catch (err) {
      console.error("Error in adding youtube url:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  updateFunnelUrl: async (req, res) => {
    try {
      const { id, funnelStatus, youtubeUrl, title, type, image, tags, videoOwner, topic, duration } = req.body;
      const trimmedFunnelStatus = funnelStatus?.trim();

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Id required",
        })
      }
      const findStatus = await db.funnelUrl.findOne({ _id: id });
      if (!findStatus) {
        return res.status(400).json({
          success: false,
          message: `Video link not found for ${funnelStatus}.`
        })
      }
      
      // Validate that type corresponds to an existing persona
      if (type) {
        const isValidPersona = await validatePersonaType(type);
        if (!isValidPersona) {
          return res.status(400).json({
            success: false,
            message: `Invalid persona type: ${type}. Please select a valid persona.`
          })
        }
      }
      
      await db.funnelUrl.updateOne({ _id: id }, { funnelStatus, youtubeUrl, title, type, image, tags, videoOwner, topic, duration });
      return res.status(200).json({
        success: true,
        message: "Data updated.",
      })
    } catch (err) {
      console.error("Error in updating youtube url:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  deleteFunnelUrlById: async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Id required",
        })
      }
      const find = await db.funnelUrl.findById(id);
      if (!find) {
        return res.status(400).json({
          success: false,
          message: "Data not found."
        })
      }
      await db.funnelUrl.deleteOne({ _id: id });
      return res.status(200).json({
        success: true,
        message: `${find.funnelStatus} url deleted.`
      })

    } catch (err) {
      console.error("Error in deleting youtube url:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  getAllFunnelUrlById: async (req, res) => {
    try {
      const { search = '', page = 1, count = 10, loggedInUser, status, funnelStatus, type, topic, public: isPublicView } = req.query;

      let loggedInUserId = null;
      // Only create ObjectId if loggedInUser is a valid 24-character hex string
      if (loggedInUser && /^[a-f\d]{24}$/i.test(loggedInUser)) {
        try {
          loggedInUserId = new mongoose.Types.ObjectId(loggedInUser);
        } catch (err) {
          // If ObjectId creation fails, just set to null
          loggedInUserId = null;
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(count);
      const limit = parseInt(count);

      const matchStage = {
        ...(status && { status }),
        ...(funnelStatus && { funnelStatus }),
        ...(topic && { topic }),
      };

      // Vue publique (learning center utilisateurs) : ne montrer que les contenus actifs,
      // hors contenus en attente/rejetés ou désactivés.
      if (isPublicView === 'true' || isPublicView === true) {
        matchStage.status = 'active';
      }

      // Handle type parameter - can be a comma-separated string or single value
      if (type) {
        const typeArray = type.split(',').map(t => t.trim()).filter(t => t);
        if (typeArray.length > 0) {
          if (typeArray.length === 1) {
            matchStage.type = typeArray[0];
          } else {
            matchStage.type = { $in: typeArray };
          }
        }
      }

      if (search.trim()) {
        matchStage.$or = [
          { funnelStatus: { $regex: search.trim(), $options: 'i' } },
          { 'tagsData.title': { $regex: search.trim(), $options: 'i' } }
        ];
      }

      const pipeline = [
        {
          $lookup: {
            from: 'tags',
            localField: 'tags',
            foreignField: '_id',
            as: 'tagsData'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'addedBy',
            foreignField: '_id',
            as: 'addedBy'
          }
        },
        {
          $unwind: {
            path: "$addedBy",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'funnelvideolikes',
            localField: '_id',
            foreignField: 'funnelUrlId',
            as: 'funnelLikes'
          }
        },
      ];

      // Add userLikes lookup only if user is logged in
      if (loggedInUserId) {
        pipeline.push({
          $lookup: {
            from: "funnelvideolikes",
            let: { funnelId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$funnelUrlId", "$$funnelId"] },
                      { $eq: ["$addedBy", loggedInUserId] }
                    ]
                  }
                }
              }
            ],
            as: "userLikes"
          }
        });
      } else {
        pipeline.push({
          $addFields: {
            userLikes: []
          }
        });
      }

      pipeline.push({
        $addFields: {
          isLiked: { $gt: [{ $size: "$userLikes" }, 0] }
        }
      });
      
      pipeline.push({ $match: matchStage });
      pipeline.push({ $sort: { createdAt: -1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      pipeline.push({
        $addFields: {
          isviewed: {
            $cond: {
              if: { $in: [loggedInUserId, "$viewersId"] },
              then: true,
              else: false
            }
          }
        }
      });
      
      pipeline.push({
        $project: {
          funnelStatus: 1,
          status: 1,
          type: 1,
          topic: 1,
          viewCount: 1,
          videoOwner: 1,
          title: 1,
          title_fr: 1,
          description_fr: 1,
          // addedBy: 1,
          image: 1,
          youtubeUrl: 1,
          tagsData: { title: 1 },
          viewersId: 1,
          isviewed: 1,
          duration: 1,
          addedBy: { fullName: 1, _id: 1, image: 1 },
          funnelLikesCount: { $size: "$funnelLikes" },
          isLiked: 1,
        }
      });

      const [funnelUrls, totalCount] = await Promise.all([
        db.funnelUrl.aggregate(pipeline),
        db.funnelUrl.aggregate([
          { $lookup: { from: 'tags', localField: 'tags', foreignField: '_id', as: 'tagsData' } },
          { $match: matchStage },
          { $count: 'total' }
        ])
      ]);

      const total = totalCount[0]?.total || 0;

      return res.status(200).json({
        success: true,
        message: 'Funnel URLs fetched successfully',
        data: funnelUrls,
        total
      });
    } catch (err) {
      console.error("Error in getting all youtube url:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  getFunnelUrlById: async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Id required",
        })
      }
      const find = await db.funnelUrl.findById(id)
        .populate('addedBy', "email fullName")
        .populate('tags', 'title')
      if (!find) {
        return res.status(400).json({
          success: false,
          message: "Data not found."
        })
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched.",
        data: find,
      })

    } catch (err) {
      console.error("Error in getting detail:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  statusChange: async (req, res) => {
    try {
      const { id, status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Id required",
        })
      }
      const record = await db.funnelUrl.findOne({ _id: id });
      if (!record) {
        return res.status(400).json({
          success: false,
          message: "Video link not found"
        })
      }

      if (status === 'active') {
        await db.funnelUrl.updateMany(
          { funnelStatus: record.funnelStatus, _id: { $ne: id }, status: 'active' },
          { $set: { status: 'inactive' } }
        );
      }

      await db.funnelUrl.updateOne({ _id: id }, { status });

      return res.status(200).json({
        success: true,
        message: `Status updated to ${status}.`
      });
    } catch (err) {
      console.error("Error chnaging status:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  }
}