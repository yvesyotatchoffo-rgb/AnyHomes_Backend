const db = require("../models");
const { message } = require("../services");
const { success } = require("../services/Response");
const constants = require("../utls/constants");
const mongoose = require("mongoose");

module.exports = {
  addNewSchool: async (req, res) => {
    try {
      const data = req.body;
      if (!data.schoolId ||
        !data.EstablishmentName ||
        !data.schoolStatus ||
        !data.address ||
        !data.schoolType ||
        !data.location ||
        !data.postalCode) {
        return res.status(400).json({
          success: false,
          message: constants.COMMON.PAYLOAD_MISSING,
        })
      }

      const findExistingSchool = await db.schools.findOne({
        schoolId: data.schoolId,
        // EstablishmentName: data.EstablishmentName,
        // establishmentType: data.establishmentType,
        // schoolType: data.schoolType
      });
      if (findExistingSchool) {
        return res.status(400).json({
          success: false,
          message: constants.SCHOOL.EXISTS
        })
      }

      const newSchool = await db.schools.create(data);
      return res.status(200).json({
        success: true,
        message: constants.SCHOOL.ADDED,
        data: newSchool._id,
      })

    } catch (err) {
      console.error("Error in adding school:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },
  getAllSchools: async (req, res) => {
    try {
      let {
        schoolType,
        schoolStatus,
        establishmentType,
        lng,
        lat,
        page,
        count,
        search,
        postalCode
      } = req.query;

      page = parseInt(page) || 1;
      count = parseInt(count) || 1000;

      let query = {
        isDeleted: false
      }

      if (schoolStatus) {
        query.schoolStatus = schoolStatus;
      }
      if (schoolType) {
        const schoolTypesArray = Array.isArray(schoolType)
          ? schoolType
          : schoolType.split(',');

        const isObjectId = (v) => /^[0-9a-f]{24}$/i.test(v);

        if (schoolTypesArray.every(isObjectId)) {
          // Admin panel sends ObjectIds directly
          query.schoolType = { $in: schoolTypesArray };
        } else {
          // Frontend sends English slugs — resolve to ObjectIds via schooltypes
          const resolvedTypes = await db.schoolTypes.find({
            slug: { $in: schoolTypesArray },
            isDeleted: false,
          }).lean();
          const typeIds = resolvedTypes.map((t) => t._id.toString());
          query.schoolType = typeIds.length > 0
            ? { $in: typeIds }
            : { $in: ['__no_match__'] };
        }
      }
      if (establishmentType) {
        query.establishmentType = establishmentType;
      }
      if (postalCode) {
        query.postalCode = Number(postalCode);
      }

      if (search) {
        query.EstablishmentName = { $regex: search, $options: 'i' }; // Case-insensitive search
      }
      let pipeline = [];

      if (lng && lat) {
        pipeline.push(
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: [Number(lng), Number(lat)]
              },
              distanceField: "distance",
              spherical: true,
              maxDistance: 5000
            }
          }
        )
      }

      pipeline.push(
        { $match: query },
        {
          $sort: { createdAt: -1 }
        },
        {
          $project: {
            id: "$_id",
            schoolId: "schoolId",
            EstablishmentName: "$EstablishmentName",
            establishmentType: "$establishmentType",
            schoolStatus: "$schoolStatus",
            address: "$address",
            schoolType: "$schoolType",
            postalCode: "$postalCode",
            phone: "$phone",
            website: "$website",
            email: "$email",
            numberOfStudents: "$numberOfStudents",
            position: "$position",
            coordX_origin: "$coordX_origin",
            coordY_origin: "$coordY_origin",
            latitude: "$latitude",
            longitude: "$longitude",
            successRate: "$successRate",
            examGrade: "$examGrade",
            distinctionRate: "$distinctionRate",
            SPI: "$SPI",
            location: "$location",
            linkedProperties: "$linkedProperties",
            isDeleted: "$isDeleted"
          }
        }
      )

      const skip = (parseInt(page) - 1) * parseInt(count);
      pipeline.push(
        { $skip: skip },
        { $limit: parseInt(count) }
      );

      const [countDoc] = await db.schools.aggregate([
        ...pipeline.slice(0, -2),
        { $count: "total" }
      ]);

      const total = countDoc?.total || 0;;

      const result = await db.schools.aggregate([...pipeline]);
      return res.status(200).json({
        success: true,
        data: result,
        total,
      });
    } catch (err) {
      console.error("Error in School Listing:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  deleteSchoolById: async (req, res) => {
    try {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.SCHOOL.ID_REQ,
        });
      }

      const deleted = await db.schools.updateOne({ _id: id }, { isDeleted: true });

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "School not found or already deleted.",
        });
      }

      return res.status(200).json({
        success: true,
        message: constants.SCHOOL.DELETED,
      });

    } catch (err) {
      console.error("Error in deleting school:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      });
    }
  },

  getSchoolById: async (req, res) => {
    try {
      const { schoolId } = req.query;
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: constants.COMMON.ID_REQUIRED,
        })
      }
      const findSchool = await db.schools.findOne({
        _id: schoolId
      })
        .populate({
          path: "linkedProperties.propertyId",
          select: "propertyTitle id"
        })

      if (!findSchool) {
        return res.status(400).json({
          success: false,
          message: "School not found!"
        })
      }
      return res.status(200).json({
        success: true,
        message: "School data fetched successfully.",
        data: findSchool,
      })
    } catch (err) {
      console.error("Error in fetching details:", err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      })
    }
  },

  updateById: async (req, res) => {
    try {
      let data = req.body;
      let dataId = data.id;
      if (!dataId) {
        return res.status(400).json({
          success: false,
          message: constants.COMMON.ID_REQUIRED,
        })
      }

      delete data.id;
      const findSchool = await db.schools.findOne({ _id: dataId })
      if (!findSchool) {
        return res.status(400).json({
          success: false,
          message: constants.SCHOOL.NOT_EXISTS,
        })
      }
      const updateSchool = await db.schools.updateOne({ _id: dataId }, data);
      return res.status(200).json({
        success: true,
        message: "School data updated successfully.",
        data: updateSchool
      })
    } catch (err) {
      console.error("Error while editing school:", err)
      return res.status(400).json({
        success: false,
        error: { code: 400, message: err.message || "Internal server error" },
      })
    }
  },

  bulkDeleteSchools: async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: "An array of school IDs is required."
        });
      }

      // Filter valid MongoDB ObjectIds
      const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid school IDs provided."
        });
      }

      const result = await db.schools.updateMany(
        { _id: { $in: validIds }, isDeleted: false },
        { $set: { isDeleted: true } }
      );

      return res.status(200).json({
        success: true,
        message: `${result.modifiedCount || 0} schools deleted successfully.`,
        deletedCount: result.modifiedCount
      });

    } catch (err) {
      console.error("Error in bulk deleting schools:", err);
      return res.status(500).json({
        success: false,
        error: { code: 500, message: err.message || "Internal server error" }
      });
    }
  }
}