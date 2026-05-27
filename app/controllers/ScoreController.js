const db = require("../models");
const scoreService = require("../services/financialScore.service");

const toObjectId = (id) => {
  try {
    return require("mongoose").Types.ObjectId(id);
  } catch (e) {
    return null;
  }
};

const computeScore = async (req, res) => {
  try {
    const { userId, propertyId, declarativeBuyerFiles: providedAnswers } = req.body;
    let declarativeBuyerFiles = providedAnswers;

    if (!declarativeBuyerFiles) {
      if (!userId) {
        return res.status(400).json({ success: false, message: "userId or declarativeBuyerFiles is required." });
      }
      const user = await db.users.findOne({ _id: userId, isDeleted: false });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      declarativeBuyerFiles = user.declarativeBuyerFiles || {};
    }

    let property = null;
    if (propertyId) {
      property = await db.property.findOne({ _id: propertyId, isDeleted: false });
      if (!property) {
        return res.status(404).json({ success: false, message: "Property not found." });
      }
    }

    const result = await scoreService.computeFinancialScore({ declarativeBuyerFiles, property });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to compute score.", error: err.message });
  }
};

const listUserScores = async (req, res) => {
  try {
    const loggedUserId = req.identity?.id;
    const logged = await db.users.findOne({ _id: loggedUserId, isDeleted: false });
    if (!logged || logged.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    const query = { isDeleted: false };
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { financingReferenceScoreSource: { $regex: search, $options: "i" } },
      ];
    }

    const users = await db.users.find(query)
      .select("fullName email financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt declarativeBuyerFiles buyerFilesCount isDocumentVerified isDeclDocumentVerified createdAt")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await db.users.countDocuments(query);

    return res.status(200).json({ success: true, data: { users, total, page, limit } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to list user scores.", error: err.message });
  }
};

const getUserScoreDetail = async (req, res) => {
  try {
    const loggedUserId = req.identity?.id;
    const logged = await db.users.findOne({ _id: loggedUserId, isDeleted: false });
    if (!logged || logged.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const { id } = req.params;
    const user = await db.users.findOne({ _id: id, isDeleted: false })
      .select(
        "fullName email financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt declarativeBuyerFiles buyerFilesCount isDocumentVerified isDeclDocumentVerified createdAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User score detail not found." });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to get user score detail.", error: err.message });
  }
};

const listInterestScores = async (req, res) => {
  try {
    const loggedUserId = req.identity?.id;
    const logged = await db.users.findOne({ _id: loggedUserId, isDeleted: false });
    if (!logged || logged.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();

    const query = { isDeleted: false };
    if (search) {
      query.$or = [
        { interestType: { $regex: search, $options: "i" } },
        { scoreClass: { $regex: search, $options: "i" } },
        { scoreLabel: { $regex: search, $options: "i" } },
        { scoreStatus: { $regex: search, $options: "i" } },
      ];
    }

    const interests = await db.interests.find(query)
      .populate("buyerId", "fullName email")
      .populate("propertyId", "propertyTitle city zipcode price offMarket chooseDocumentMinProbability chooseDocumentGrade")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await db.interests.countDocuments(query);

    return res.status(200).json({ success: true, data: { interests, total, page, limit } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to list interest scores.", error: err.message });
  }
};

const getInterestScoreDetail = async (req, res) => {
  try {
    const loggedUserId = req.identity?.id;
    const logged = await db.users.findOne({ _id: loggedUserId, isDeleted: false });
    if (!logged || logged.role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized." });
    }

    const { id } = req.params;
    const interest = await db.interests.findOne({ _id: id, isDeleted: false })
      .populate("buyerId", "fullName email declarativeBuyerFiles isDocumentVerified isDeclDocumentVerified financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt createdAt")
      .populate("propertyId", "propertyTitle city zipcode price offMarket chooseDocumentMinProbability chooseDocumentGrade")
      .lean();

    if (!interest) {
      return res.status(404).json({ success: false, message: "Interest score detail not found." });
    }

    return res.status(200).json({ success: true, data: interest });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to get interest score detail.", error: err.message });
  }
};

module.exports = {
  computeScore,
  listUserScores,
  listInterestScores,
  getUserScoreDetail,
  getInterestScoreDetail,
};
