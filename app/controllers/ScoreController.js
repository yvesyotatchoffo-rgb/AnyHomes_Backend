const db = require("../models");
const mongoose = require("mongoose");
const scoreService = require("../services/financialScore.service");

const toObjectId = (id) => {
  try {
    return mongoose.Types.ObjectId(id);
  } catch (e) {
    return null;
  }
};

const computeScore = async (req, res) => {
  try {
    const { userId, propertyId, declarativeBuyerFiles: providedAnswers } = req.body;
    let declarativeBuyerFiles = providedAnswers;

    if (userId && !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ success: false, message: "Invalid userId." });
    }
    if (propertyId && !mongoose.Types.ObjectId.isValid(String(propertyId))) {
      return res.status(400).json({ success: false, message: "Invalid propertyId." });
    }

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

const computeRenterScore = async (req, res) => {
  try {
    const { userId, declarativeRenterFiles: providedAnswers } = req.body;
    let declarativeRenterFiles = providedAnswers;

    if (!declarativeRenterFiles) {
      if (!userId) {
        return res.status(400).json({ success: false, message: "userId or declarativeRenterFiles is required." });
      }
      const user = await db.users.findOne({ _id: userId, isDeleted: false });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found." });
      }
      declarativeRenterFiles = user.declarativeRenterFiles || {};
    }

    const result = await scoreService.computeRenterScore({ declarativeRenterFiles });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to compute renter score.", error: err.message });
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
    if (req.query.renter === "true" || req.query.renterOnly === "true" || req.query.type === "renter") {
      query.renterFinancingReferenceScoreUpdatedAt = { $exists: true };
    }
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { financingReferenceScoreSource: { $regex: search, $options: "i" } },
        { renterFinancingReferenceScoreSource: { $regex: search, $options: "i" } },
      ];
    }

    const users = await db.users.find(query)
      .select("fullName email financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt renterFinancingReferenceScore renterFinancingReferenceScoreSource renterFinancingReferenceScoreUpdatedAt declarativeBuyerFiles buyerFilesCount isDocumentVerified isDeclDocumentVerified createdAt")
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
        "fullName email financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt renterFinancingReferenceScore renterFinancingReferenceScoreSource renterFinancingReferenceScoreUpdatedAt declarativeBuyerFiles declarativeRenterFiles buyerFilesCount isDocumentVerified isDeclDocumentVerified createdAt"
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
    if (req.query.propertyType) {
      query.propertyType = req.query.propertyType;
    }
    if (req.query.rental === "true" || req.query.tenant === "true" || req.query.isRental === "true") {
      query.propertyType = "rent";
    }
    if (search) {
      query.$or = [
        { interestType: { $regex: search, $options: "i" } },
        { scoreClass: { $regex: search, $options: "i" } },
        { scoreLabel: { $regex: search, $options: "i" } },
        { scoreStatus: { $regex: search, $options: "i" } },
        { renterScoreLabel: { $regex: search, $options: "i" } },
        { renterScoreStatus: { $regex: search, $options: "i" } },
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
      .populate("buyerId", "fullName email declarativeBuyerFiles declarativeRenterFiles isDocumentVerified isDeclDocumentVerified financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt createdAt")
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

const getPublicInterestScoreDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Interest id is required." });
    }

    const isGuestRequest =
      req.isGuest === true ||
      req.query.guest === true ||
      req.query.guest === "true" ||
      req.query.guest === "1" ||
      req.headers["x-guest-mode"] === true ||
      req.headers["x-guest-mode"] === "true" ||
      req.headers["x-guest-mode"] === "1";

    let interest = null;
    if (isGuestRequest && id.startsWith("guest-interest-")) {
      const { buildGuestInterestCards } = require("../controllers/InterestsController");
      const cards = buildGuestInterestCards(req);
      interest = cards.find((card) => card._id === id);
      if (interest) {
        interest = {
          ...interest,
          scoreLabel: interest.scoreLabel || interest.financialScoreSource || "Crédibilité financière",
          topReasons: interest.topReasons || [],
          scoreStatus: interest.scoreStatus || "OK",
          scoreClass: interest.scoreClass || "",
        };
      }
    }

    if (!interest) {
      if (!mongoose.Types.ObjectId.isValid(String(id))) {
        return res.status(400).json({ success: false, message: "Invalid interest id." });
      }

      interest = await db.interests.findOne({ _id: id, isDeleted: false })
        .populate("buyerId", "fullName firstName lastName email city country image documentGrade financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt buyerFiles isDocumentVerified isDeclDocumentVerified")
        .populate("propertyId", "propertyTitle city zipcode price offMarket chooseDocumentMinProbability chooseDocumentGrade")
        .lean();
    }

    if (!interest) {
      return res.status(404).json({ success: false, message: "Interest not found." });
    }

    const isRentalInterest = String(interest.propertyId?.propertyType || "").toLowerCase() === "rent";
    const score = isRentalInterest
      ? interest.renterScore ?? interest.renterReferenceScore ?? interest.financialScore ?? interest.financingReferenceScore ?? interest.financingProbability ?? 0
      : interest.financialScore ?? interest.financingReferenceScore ?? interest.financingProbability ?? 0;
    const scoreLabel = isRentalInterest
      ? interest.renterScoreLabel || interest.scoreLabel || "Indice confiance locative :"
      : interest.scoreLabel || interest.financialScoreSource || "Crédibilité financière";
    const topReasons = Array.isArray(isRentalInterest ? interest.renterTopReasons : interest.topReasons) && (isRentalInterest ? interest.renterTopReasons : interest.topReasons).length > 0
      ? (isRentalInterest ? interest.renterTopReasons : interest.topReasons)
      : [
          score >= 85
            ? "Le dossier présente des signaux très favorables pour ce projet."
            : score >= 70
              ? "Le dossier montre une bonne capacité de financement et une cohérence globale."
              : score >= 55
                ? "Le dossier est globalement valable mais présente des éléments de vigilance."
                : score >= 40
                  ? "Le dossier présente plusieurs fragilités pouvant impacter le financement."
                  : "Le dossier reste insuffisant pour ce niveau de financement estimé.",
        ];

    return res.status(200).json({
      success: true,
      data: {
        score,
        score_label: scoreLabel,
        top_reasons: topReasons,
        score_status: isRentalInterest ? (interest.renterScoreStatus || interest.scoreStatus || "OK") : (interest.scoreStatus || "OK"),
        score_class: isRentalInterest ? (interest.renterScoreClass || interest.scoreClass || "") : (interest.scoreClass || ""),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to get interest score detail.", error: err.message });
  }
};

module.exports = {
  computeScore,
  computeRenterScore,
  listUserScores,
  listInterestScores,
  getUserScoreDetail,
  getInterestScoreDetail,
  getPublicInterestScoreDetail,
};
