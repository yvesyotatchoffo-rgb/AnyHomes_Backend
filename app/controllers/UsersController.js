"use strict";
var mongoose = require("mongoose");
const db = require("../models");
const Users = db.users;
const Properties = db.property;
const Devices = db.devices;
const ProServiceEn = require("../modules/services-marketplace/models/ProService_en.model");
const ProServiceFr = require("../modules/services-marketplace/models/ProService_fr.model");
const FRONT_WEB_URL = process.env.FRONT_WEB_URL || "http://localhost:8089";
const BACK_WEB_URL = process.env.BACK_WEB_URL || `http://localhost:${process.env.PORT || 6089}`;
var bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const constants = require("../utls/constants");
const Emails = require("../Emails/onBoarding");
const helper = require("../utls/helper");
const scoreService = require("../services/financialScore.service");

function generateOTP() {
  let digits = "0123456789";
  let OTP = "";
  let len = digits.length;
  for (let i = 0; i < 4; i++) {
    OTP += digits[Math.floor(Math.random() * len)];
  }
  return OTP;
}
// Allowed signup objectives (used to validate incoming signup payloads)
const ALLOWED_SIGNUP_OBJECTIVES = [
  "Acheter",
  "Louer",
  "Planifier mon projet",
  "Opportunités hors marché",
  "Vendre ma propriété",
  "Louer ma propriété",
  "Évaluer ma propriété",
  "Préparer une vente future",
];

const REQUIRED_FEATURED_FIELDS = [
  "featuredSubheading",
  "featuredTitle",
  "featuredBio",
  "featuredExperienceYears",
  "featuredClientsAccompanied",
  "featuredRatingNotes",
  "featuredSatisfactionRate",
  "featuredProfilePhoto",
];

const isFeaturedProfileComplete = (pro) => {
  if (!pro) return false;
  return Boolean(
    pro.featuredSubheading &&
    pro.featuredTitle &&
    pro.featuredBio &&
    Number(pro.featuredExperienceYears) > 0 &&
    Number(pro.featuredClientsAccompanied) > 0 &&
    pro.featuredRatingNotes &&
    pro.featuredSatisfactionRate &&
    pro.featuredProfilePhoto
  );
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

const getTopAgentLabel = (role) => {
  if (role === "agency") return "Top Agency";
  if (role === "agent") return "Top Agent";
  if (role === "hunter") return "Top Hunter";
  return "Top Pro";
};

const getPhotoUrl = (photo) => {
  if (!photo) return null;
  if (typeof photo === "string") return photo;
  if (photo.url) return photo.url;
  if (photo.imageUrl) return photo.imageUrl;
  if (photo.fileName) return `${BACK_WEB_URL}/uploads/${photo.fileName}`;
  if (photo.originalname) return `${BACK_WEB_URL}/uploads/${photo.originalname}`;
  if (photo.path) return `${BACK_WEB_URL}/${photo.path.replace(/^\//, "")}`;
  return null;
};

const getPropertyThumbnailUrl = (images) => {
  if (!images || !Array.isArray(images) || images.length === 0) return null;
  return getPhotoUrl(images[0]);
};

const getPublicPropertyUrl = (propertyId) => `${FRONT_WEB_URL}/property-details?id=${propertyId}`;

const PROPERTY_TYPE_LABELS = {
  sale: "À vendre",
  rent: "À louer",
  directory: "Annuaire",
};

const mapPropertyForAdminDetail = (property) => ({
  id: property._id,
  title: property.propertyTitle || property.name || "Sans titre",
  propertyType: property.propertyType || "sale",
  typeLabel: PROPERTY_TYPE_LABELS[property.propertyType] || PROPERTY_TYPE_LABELS.sale,
  city: property.city || null,
  zipcode: property.zipcode || null,
  price: property.price || null,
  status: property.status || null,
  thumbnailUrl: getPropertyThumbnailUrl(property.images),
  publicUrl: getPublicPropertyUrl(property._id),
});

module.exports = {
  adminLogin: async (req, res) => {
    try {
      const data = req.body;
      console.log(data)
      if (!req.body.email || typeof req.body.email == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.EMAIL_REQUIRED,
          },
        });
      }

      if (!req.body.password || typeof req.body.password == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.PASSWORD_REQUIRED,
          },
        });
      }

      var query = {};
      query.email = data.email.toLowerCase();
      query.isDeleted = false;

      var user = await Users.findOne(query);

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.INVALID_CREDENTIAL,
          },
        });
      }

      if (user && user.status == "deactive") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      }
      if (user.role != "admin" && user.role != "staff") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.NOT_VALID,
          },
        });
      }

      if (user && user.status != "active" && user.isVerified != "Y") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      }

      if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.WRONG_PASSWORD,
          },
        });
      } else {
        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET,
          {
            expiresIn: "24h",
          }
        );
        var admindata;
        admindata = Object.assign({}, user._doc);
        admindata["access_token"] = token;

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.LOGIN_SUCCESS,
          data: admindata,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  userLogin: async (req, res) => {
    try {
      const data = req.body;
      const { deviceId, deviceToken, ipAddress } = req.body;
      if (!deviceId && !deviceToken && !ipAddress) {
        return res.status(400).json({
          success: false,
          message: "Device information is required"
        })
      }
      if (!req.body.email || typeof req.body.email == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.EMAIL_REQUIRED,
          },
        });
      }

      if (!req.body.password || typeof req.body.password == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.PASSWORD_REQUIRED,
          },
        });
      }

      var query = {};
      query.email = data.email.toLowerCase();

      query.isDeleted = false;
      var user = await Users.findOne(query)
        .populate("planId")
      if (user && user.role === "admin") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ONLY_USER_LOGIN,
          },
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.NO_USER_EXIST,
          },
        });
      }

      if (user && user.status == "deactive") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      }

      if (user && user.isVerified != "Y") {
        const otp = await generateOTP();
        var usersData = await Users.updateOne(
          { email: user.email },
          { otp: otp }
        );

        await Emails.verificationOtp({
          email: user.email,
          fullName: user.fullName,
          otp: otp,
        });
        return res.status(400).json({
          success: true,
          message: "Your account is not verified. Please verify your account."
        })
      }

      if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.WRONG_PASSWORD,
          },
        });
      } else {
        if (data.mode == "mobile" && user.twoStepsEnable === "active") {
          const generateOtp = await helper.generateOTP(6);

          let sendLoginOtp = await db.users.updateOne({ _id: user._id, isDeleted: false }, { otp: generateOtp, });
          let email_payload = {
            email: user.email,
            firstName: user.firstName,
            fullName: user.fullName,
            otp: generateOtp,
            deviceId: data.deviceId,
            deviceToken: data.deviceToken
            // mode: data.mode
          }
          await Emails.verificationOtp(email_payload);
          return res.status(200).json({
            success: true,
            code: 200,
            message: "OTP has been sent to your mail. Please verify and login",
          });

        } else {
          const token = jwt.sign(
            {
              id: user._id,
              role: user.role,
            },
            process.env.JWT_SECRET,
            {
              expiresIn: "10h",
            }
          );
          // user["access_token"] = token
          let count_property = await db.property.countDocuments({
            addedBy: user.id,
          });
          let count_follow = await db.followUnfollow.countDocuments({
            user_id: user.id,
          });

          let count_likes = await db.favorites.countDocuments({
            user_id: user.id,
          });
          let folderCount = await db.folder.countDocuments({
            addedBy: user.id,
            isDeleted: false,
          });
          let propertyInFolder = await db.folder.find({
            addedBy: user.id,
            isDeleted: false,
          });
          let totalpropertiesInFolder = 0;
          if (propertyInFolder.length > 0) {
            for (let itm of propertyInFolder) {
              totalpropertiesInFolder =
                totalpropertiesInFolder + itm.property_id.length; // Corrected here
            }
          }
          let userData = Object.assign({}, user._doc);
          userData["access_token"] = token;
          userData["total_property"] = count_property;
          userData["isVerified"] = user.isVerified;
          userData["total_likes"] = count_likes;
          userData["total_followers"] = count_follow;
          userData.id = userData._id;
          userData.folderCount = folderCount;
          userData.totalpropertiesInFolder = totalpropertiesInFolder;
          if (data.deviceId) {
            let findDevice = await Devices.findOne({ deviceId: data.deviceId });
            if (findDevice) {
              if (
                findDevice.deviceToken != data.deviceToken ||
                findDevice.userId != userData._id
              ) {
                await Devices.updateOne(
                  { _id: findDevice._id },
                  {
                    deviceToken: data.deviceToken,
                    userId: userData._id,
                  }
                );
              }
            } else {
              let insertData = {
                deviceId: data.deviceId,
                userId: userData._id,
                deviceToken: data.deviceToken,
              };
              await Devices.create(insertData);
            }
          }
          delete userData.password;
          let findSession = await db.sessions.findOne({
            userId: user._id,
            deviceId: data.deviceId,
            deviceToken: data.deviceToken,
            isDeleted: false,
            status: "active"
            // LogoutTime: null
          })
          if (findSession) {
            await db.sessions.updateOne({
              userId: user._id,
              deviceId: data.deviceId,
              deviceToken: data.deviceToken,
              isDeleted: false,
              status: "active"
            },
              {
                LoginTime: new Date,
                // status: "active"
              })
          }

          const createSession = await db.sessions.create({
            userId: user._id,
            deviceId: data.deviceId,
            ipAddress: data.ipAddress,
            deviceToken: data.deviceToken,
            LoginTime: new Date(),
            browser: data.browser,
            LogoutTime: null,
            status: "active"
          })
          return res.status(200).json({
            success: true,
            message: constants.onBoarding.LOGIN_SUCCESS,
            data: userData,
          });
        }
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  logout: async (req, res) => {
    try {
      let { deviceId, deviceToken } = req.query;
      let userId = req.identity.id;
      if (!userId || !deviceId || !deviceToken) {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.PAYLOAD_MISSING,
        });
      }

      let findDeviceData = await Devices.findOne({
        userId: userId,
        deviceId: deviceId,
        deviceToken: deviceToken,
      });

      if (findDeviceData) {
        await Devices.deleteOne({ _id: findDeviceData._id });

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.LOGOUT,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "User not exist or device not linked.",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: error.message || "Internal Server Error",
        },
      });
    }
  },
  autoLogin: async (req, res) => {
    try {
      const data = req.body;
      if (!req.body.email || typeof req.body.email == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.EMAIL_REQUIRED,
          },
        });
      }

      var query = {};
      query.email = data.email.toLowerCase();

      query.isDeleted = false;
      var user = await Users.findOne(query);
      if (user && user.role === "admin") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ONLY_USER_LOGIN,
          },
        });
      }
      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.NO_USER_EXIST,
          },
        });
      }

      if (user && user.status == "deactive") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      }

      if (user && user.isVerified != "Y") {
        return res.status(404).json({
          success: false,
          id: user.id,
          error: {
            code: 404,
            message: constants.onBoarding.NOT_VERIFIED,
          },
        });
      }
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "10h",
        }
      );
      // user["access_token"] = token

      let userData = Object.assign({}, user._doc);

      userData["access_token"] = token;
      userData["isVerified"] = user.isVerified;
      delete userData.password;
      return res.status(200).json({
        success: true,
        message: constants.onBoarding.LOGIN_SUCCESS,
        data: userData,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: "" + err },
      });
    }
  },

  autoLoginById: async (req, res) => {
    try {
      const { user_id } = req.body;

      if (!user_id || typeof user_id === "undefined") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USER_ID_REQUIRED,
          },
        });
      }

      const query = {
        _id: user_id,
        isDeleted: false,
      };

      const user = await Users.findOne(query);
      if (user && user.role === "admin") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ONLY_USER_LOGIN,
          },
        });
      }

      if (!user) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.NO_USER_EXIST,
          },
        });
      }

      if (user && user.status === "deactive") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      }

      if (user && user.isVerified !== "Y") {
        return res.status(404).json({
          success: false,
          id: user._id,
          error: {
            code: 404,
            message: constants.onBoarding.NOT_VERIFIED,
          },
        });
      }

      const token = jwt.sign(
        {
          id: user._id,
          role: user.role?._id || user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "10h" }
      );

      let userData = Object.assign({}, user._doc);
      userData["access_token"] = token;
      userData["isVerified"] = user.isVerified;
      delete userData.password;

      return res.status(200).json({
        success: true,
        message: constants.onBoarding.LOGIN_SUCCESS,
        data: userData,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },

  adminProfileData: async (req, res) => {
    try {
      const id = req.query.id;

      const user_data = await Users.findOne({
        _id: id,
      });
      if (!user_data) {
        return res.status(404).json({
          success: false,
          error: {
            code: "404",
            message: constants.onBoarding.ACCOUNT_NOT_FOUND,
          },
        });
      }
      var profileData;
      profileData = Object.assign({}, user_data._doc);
      if (user_data) {
        return res.status(200).json({
          success: true,
          data: profileData,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  userDetail: async (req, res) => {
    try {
      const id = req.query.id;
      const isGuest = String(req.query.guest) === 'true';

      if (isGuest) {
        const user = {
          _id: 'guest-user-000',
          id: 'guest-user-000',
          fullName: 'Bookaroo Guest',
          email: 'guest@bookaroo.local',
          accountType: 'guest',
          isGuest: true,
          renterFilesCount: 4,
          renterFiles: {
            identityProof: [
              {
                fileName: 'guest-carte-didentite.pdf',
                originalname: 'Carte d’identité',
                checked: true,
              },
            ],
            addressProof: [
              {
                fileName: 'guest-justificatif-domicile.pdf',
                originalname: 'Justificatif de domicile (facture EDF)',
                checked: true,
              },
            ],
            salarySlips: [
              {
                fileName: 'guest-bulletin-salaire-janvier.pdf',
                originalname: 'Bulletin de salaire - janvier',
                checked: true,
              },
              {
                fileName: 'guest-bulletin-salaire-fevrier.pdf',
                originalname: 'Bulletin de salaire - février',
                checked: true,
              },
              {
                fileName: 'guest-bulletin-salaire-mars.pdf',
                originalname: 'Bulletin de salaire - mars',
                checked: true,
              },
            ],
            otherDocs: [
              {
                fileName: 'guest-lettre-motivation.pdf',
                originalname: 'Lettre de motivation',
                checked: true,
              },
            ],
          },
          buyerFilesCount: 8,
          buyerFiles: {
            identityProof: [
              {
                fileName: 'guest-carte-didentite.pdf',
                originalname: 'Carte d’identité',
                checked: true,
              },
            ],
            familySituation: [
              {
                fileName: 'guest-certificat-situation-familiale.pdf',
                originalname: 'Certificat de situation familiale',
                checked: true,
              },
            ],
            addressProof: [
              {
                fileName: 'guest-justificatif-domicile-facture-edf.pdf',
                originalname: 'Justificatif de domicile - facture EDF',
                checked: true,
              },
            ],
            salarySlips: [
              {
                fileName: 'guest-bulletin-salaire-janvier-2026.pdf',
                originalname: 'Bulletin de salaire janvier 2026',
                checked: true,
              },
              {
                fileName: 'guest-bulletin-salaire-fevrier-2026.pdf',
                originalname: 'Bulletin de salaire février 2026',
                checked: true,
              },
              {
                fileName: 'guest-bulletin-salaire-mars-2026.pdf',
                originalname: 'Bulletin de salaire mars 2026',
                checked: true,
              },
            ],
            preAcceptance: [
              {
                fileName: 'guest-accord-de-principe.pdf',
                originalname: 'Lettre d’accord de principe',
                checked: true,
              },
            ],
            bankStatement: [
              {
                fileName: 'guest-releve-bancaire-janvier.pdf',
                originalname: 'Relevé bancaire janvier',
                checked: true,
              },
              {
                fileName: 'guest-releve-bancaire-fevrier.pdf',
                originalname: 'Relevé bancaire février',
                checked: true,
              },
              {
                fileName: 'guest-releve-bancaire-mars.pdf',
                originalname: 'Relevé bancaire mars',
                checked: true,
              },
            ],
            taxNotice: [
              {
                fileName: 'guest-avis-imposition-2024.pdf',
                originalname: 'Avis d’imposition 2024',
                checked: true,
              },
              {
                fileName: 'guest-avis-imposition-2023.pdf',
                originalname: 'Avis d’imposition 2023',
                checked: true,
              },
            ],
            personalContribution: [
              {
                fileName: 'guest-attestation-epargne-personnelle.pdf',
                originalname: 'Attestation d’épargne personnelle',
                checked: true,
              },
            ],
          },
          declarativeBuyerFiles: {
            BuyOption: 'alone',
            InvestOption: 'primary',
            postalCode: '75011',
          },
          declarativeRenterFiles: {
            BuyOption: 'alone',
            InvestOption: 'primary',
            postalCode: '',
          },
          total_property: 0,
          total_likes: 0,
          total_alerts: 0,
          total_followers: 0,
          folderCount: 0,
          totalpropertiesInFolder: 0,
          rentProperties: 0,
          saleProperties: 0,
          offmarketProperties: 0,
          directoryProperties: 0,
          propertiesList: [],
        };
        return res.status(200).json({
          success: true,
          data: user,
        });
      }

      const user_data = await Users.findOne({
        _id: id,
      })
        .populate("planId")
      let user = Object.assign({}, user_data._doc);
      let count_property = await db.property.countDocuments({ addedBy: id, isDeleted: false });
      let count_follow = await db.followUnfollow.countDocuments({
        user_id: id, isDeleted: false, follow_unfollow: true
      });
      let countAlerts = await db.alerts.countDocuments({ user_id: id, isDeleted: false });
      let totalRentProp = await db.property.countDocuments({ propertyType: "rent", addedBy: id, isDeleted: false });
      let totalOffMarketProp = await db.property.countDocuments({ offMarket: true, addedBy: id, isDeleted: false });
      let totalDirectoryProp = await db.property.countDocuments({ propertyType: "directory", addedBy: id, isDeleted: false });
      let totalSaleProp = await db.property.countDocuments({ propertyType: "sale", addedBy: id, isDeleted: false });

      let count_likes = await db.favorites.countDocuments({ user_id: id, like: true, isDeleted: false });
      let folderCount = await db.folder.countDocuments({ addedBy: id, isDeleted: false, });
      let propertyInFolder = await db.folder.find({ addedBy: id, isDeleted: false, });
      let totalpropertiesInFolder = 0;
      if (propertyInFolder.length > 0) {
        for (let itm of propertyInFolder) {
          totalpropertiesInFolder =
            totalpropertiesInFolder + itm.property_id.length; // Corrected here
        }
      }
      const renterFilesCount = user_data.renterFiles ? Object.keys(user_data.renterFiles).length : 0;
      const sellerFilesCount = user_data.sellerFiles ? Object.keys(user_data.sellerFiles).length : 0;
      const buyerFilesCount = user_data.buyerFiles ? Object.keys(user_data.buyerFiles).length : 0;
      const userProperties = await db.property.find(
        { addedBy: id, isDeleted: false },
        { propertyTitle: 1, address: 1, location: 1, propertyType: 1, rooms: 1, bathrooms: 1, images: 1 }
      );

      user.propertiesList = userProperties;


      user.total_property = count_property;
      user.total_likes = count_likes;
      user.total_alerts = countAlerts;
      user.total_followers = count_follow;
      user.folderCount = folderCount;
      user.totalpropertiesInFolder = totalpropertiesInFolder;
      user.rentProperties = totalRentProp;
      user.saleProperties = totalSaleProp;
      user.offmarketProperties = totalOffMarketProp;
      user.directoryProperties = totalDirectoryProp;

      user.renterFilesCount = renterFilesCount;
      user.sellerFilesCount = sellerFilesCount;
      user.buyerFilesCount = buyerFilesCount;
      if (user) {
        return res.status(200).json({
          success: true,
          data: user,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  editUserDetails: async (req, res) => {
    console.log('@editUserDetails');
    
    try {
      const isGuest = String(req.query.guest) === 'true';
      if (isGuest) {
        return res.status(400).json({
          success: false,
          message: 'Guest mode is read-only. Changes are not allowed.',
        });
      }
      let data = req.body;
      let userData = await Users.findOne({ _id: data.userId });
      if (userData) {
        if (req.body.firstName && req.body.lastName) {
          data["fullName"] = req.body.firstName + " " + req.body.lastName;
        }
        if (data.renterFiles && data.renterFiles.identityProof.length > 0) {
          data.renterfileIdenityVerification = true

        } 
        
        if (data.renterFiles) {
          if(userData.renterFilesAddedAt == null || userData.renterFilesAddedAt == '' ){
            data.renterFilesAddedAt = new Date()
          }
        }

        if (data.buyerFiles && data.buyerFiles.identityProof.length > 0) {
          data.buyerfileIdenityVerification = true
        } 

        if (data.buyerFiles) {
          if(userData.buyerFilesAddedAt == null || userData.buyerFilesAddedAt == '' ) {
            data.buyerFilesAddedAt = new Date()
          }
        }

        if (data.sellerFiles) {
          if(userData.sellerFilesAddedAt == null || userData.sellerFilesAddedAt == '' ) {
            data.sellerFilesAddedAt = new Date()
          }
        }

        if (data.renterFiles && data.renterFiles.identityProof.length === 0) {
          data.renterfileIdenityVerification = false
        }

        if (data.buyerFiles && data.buyerFiles.identityProof.length === 0) {
          data.buyerfileIdenityVerification = false
        }

        if (data.sellerFiles && data.sellerFiles.length === 0) {
          await db.property.updateMany({ addedBy: data.userId, isDeleted: false }, { identityVerified: false })
        }

        let scoreResult;
        let renterScoreResult;
        if (data.declarativeBuyerFiles) {
          scoreResult = await scoreService.computeFinancialScore({
            declarativeBuyerFiles: data.declarativeBuyerFiles,
          });
          data.financingReferenceScore = scoreResult.score || 0;
          data.financingReferenceScoreSource = "auto";
          data.financingReferenceScoreUpdatedAt = new Date();
        }

        if (data.declarativeRenterFiles) {
          renterScoreResult = await scoreService.computeRenterScore({
            declarativeRenterFiles: data.declarativeRenterFiles,
          });
          data.renterFinancingReferenceScore = renterScoreResult.score || 0;
          data.renterFinancingReferenceScoreSource = "auto";
          data.renterFinancingReferenceScoreUpdatedAt = new Date();
        }

        await Users.updateOne({ _id: userData._id }, data);
        return res.status(200).json({
          success: true,
          code: 200,
          message: constants.onBoarding.PROFILE_UPDATED,
          scoringResult: scoreResult || renterScoreResult || null,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.ACCOUNT_NOT_FOUND,
        });
      }
    } catch (err) {
      console.log(err, '=== error');

      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  editUserEmail: async (req, res) => {
    try {
      let data = req.body;
      if (!data.currentEmail || !data.newEmail) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      let userData = await Users.findOne({ email: data.currentEmail, isDeleted: false });
      if (userData) {
        let findNewEmail = await Users.findOne({ email: data.newEmail, isDeleted: false });
        if (findNewEmail) {
          return res.status(400).json({
            success: false,
            message: constants.onBoarding.NEW_EMAIL_EXIST,
          });
        }
        const generateOtp = await helper.generateOTP(6);

        let updateNewEmail = await Users.updateOne({ email: data.currentEmail, isDeleted: false }, { otp: generateOtp, });

        if (updateNewEmail) {
          let email_payload = {
            email: data.currentEmail,
            fullName: userData.firstName,
            generateOtp: generateOtp,
            newEmail: data.newEmail,
            mode: data.mode,


          };
          await Emails.changeEmail(email_payload);
          return res.status(200).json({
            success: true,
            code: 200,
            message: constants.onBoarding.OTP_SENT,
          });
        }
        // }
      } else {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.ACCOUNT_NOT_FOUND,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  sendOtpOnNewEmail: async (req, res) => {
    try {
      let data = req.body;
      if (!data.currentEmail || !data.newEmail || !data.otp) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      let userData = await Users.findOne({ email: data.currentEmail, isDeleted: false, otp: data.otp });
      if (userData) {
        let findNewEmail = await Users.findOne({ email: data.newEmail, isDeleted: false });
        if (findNewEmail) {
          return res.status(400).json({
            success: false,
            message: constants.onBoarding.NEW_EMAIL_EXIST,
          });
        }
        const generateOtp = await helper.generateOTP(6);

        // let updateNewEmail = await Users.updateOne({ email: data.currentEmail, isDeleted: false }, { email: data.newEmail, otp: generateOtp, });
        let updateNewEmail = await Users.updateOne({ email: data.currentEmail, isDeleted: false }, { otp: generateOtp, });

        if (updateNewEmail) {
          let email_payload = {
            email: data.newEmail,
            fullName: userData.firstName,
            generateOtp: generateOtp,
            // newEmail: data.newEmail,
            currentEmail: data.currentEmail,
            mode: data.mode,

          };
          await Emails.changeEmailOtp(email_payload);
          return res.status(200).json({
            success: true,
            code: 200,
            message: constants.onBoarding.OTP_SENT,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.INVALID_OTP,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  verifyOtpOnNewEmail: async (req, res) => {
    try {
      let data = req.body;
      if (!data.newEmail || !data.otp || !data.currentEmail) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      let latestEmail = data.newEmail.toLowerCase();
      let userData = await Users.findOne({ email: data.currentEmail, isDeleted: false, otp: data.otp });
      if (userData) {
        // await Users.updateOne({ email: data.currentEmail, isDeleted: false, otp: data.otp})

        let findProperty = await db.property.find({ addedBy: userData._id });
        if (!findProperty || findProperty.length !== 0) {
          const updatePropertyEmail = await db.property.updateMany({ addedBy: userData._id }, { email: latestEmail })
        }

        await Users.updateOne({ email: data.currentEmail, isDeleted: false }, { email: latestEmail })
        return res.status(200).json({
          success: true,
          code: 200,
          message: "Otp matched and Email updated",
        });

      } else {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.INVALID_OTP,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  adminUpdateProfile: async (req, res) => {
    try {
      let id = req.body.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      if (req.body.firstName && req.body.lastName) {
        req.body.fullName = req.body.firstName + " " + req.body.lastName;
      }
      const user = await Users.findOne({
        _id: id,
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "404",
            message: constants.onBoarding.ACCOUNT_NOT_FOUND,
          },
        });
      }

      const requestedGlobalFav = normalizeBoolean(req.body.isGlobalFavorite);
      const requestedLocalFav = normalizeBoolean(req.body.isLocalFavorite);
      const requestedTopAgent = normalizeBoolean(req.body.isTopAgent);

      if ((requestedGlobalFav || requestedLocalFav || requestedTopAgent) && user.accountType !== "pro") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Only pro users can be marked as favorites or top agents.",
          },
        });
      }

      if ((requestedGlobalFav || requestedLocalFav || requestedTopAgent) && !user.partnerAssignedAt) {
        req.body.partnerAssignedAt = new Date();
      }

      if ((requestedGlobalFav || requestedLocalFav || requestedTopAgent) && !user.partnerAssignedAt) {
        req.body.partnerAssignedAt = new Date();
      }

      if (requestedLocalFav) {
        let localCodes = req.body.localFavoritePostalCodes;
        if (typeof localCodes === "string") {
          localCodes = localCodes.split(",").map((code) => code.trim()).filter(Boolean);
        }
        if (localCodes && Array.isArray(localCodes)) {
          req.body.localFavoritePostalCodes = localCodes;
        }
        if (!user.isLocalFavorite && (!Array.isArray(req.body.localFavoritePostalCodes) || req.body.localFavoritePostalCodes.length === 0)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: "Local favorite requires at least one postal code.",
            },
          });
        }
      }

      if (requestedGlobalFav && !user.isGlobalFavorite) {
        const existingGlobals = await Users.find({
          accountType: "pro",
          isGlobalFavorite: true,
          isDeleted: false,
          _id: { $ne: id },
        }).select("fullName email").limit(3);
        if (existingGlobals.length >= 2) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: `Impossible d'ajouter un 3ème favori global. Déjà en place : ${existingGlobals.map((u) => u.fullName || u.email).join(", ")}`,
            },
          });
        }
      }

      if (requestedLocalFav && !user.isLocalFavorite) {
        const existingLocals = await Users.find({
          accountType: "pro",
          isLocalFavorite: true,
          isDeleted: false,
          _id: { $ne: id },
        }).select("fullName email localFavoritePostalCodes").limit(3);
        if (existingLocals.length >= 2) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: `Impossible d'ajouter un 3ème favori local. Déjà en place : ${existingLocals.map((u) => u.fullName || u.email).join(", ")}`,
            },
          });
        }
      }

      const updatedUser = await Users.updateOne(
        {
          _id: id,
        },
        req.body
      );

      return res.status(200).json({
        success: true,
        data: updatedUser,
        message: constants.onBoarding.PROFILE_UPDATED,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  deleteProfile: async (req, res) => {
    try {
      let id = req.query.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      const user = await Users.findOne({
        _id: id,
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: "404",
            message: constants.onBoarding.ACCOUNT_NOT_FOUND,
          },
        });
      }

      const updatedUser = await Users.updateOne(
        {
          _id: id,
        },
        { isDeleted: true }
      );

      return res.status(200).json({
        success: true,
        message: constants.onBoarding.PROFILE_DELETED,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  activateDeactivateProfile: async (req, res) => {
    try {
      let id = req.body.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      const user = await Users.findOne({
        _id: id,
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: constants.onBoarding.ACCOUNT_NOT_FOUND,
        });
      }
      const query = {
        status: "active",
      };
      let message;
      let message1;
      if (user.status == "active") {
        query.status = "deactive";
        message = "Deactive successfully";
      } else {
        query.status = "active";
        message1 = "Active successfully";
      }
      const updateData = await Users.updateOne(
        {
          _id: id,
        },
        query
      );
      if (updateData) {
        return res.status(200).json({
          success: true,
          message: user.status === "deactive" ? message1 : message,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  getList: async (req, res) => {
    try {
      const { count, sort, search, page, role } = req.query;

      if (!count || !page) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }

      const limitNumber = parseInt(count, 10);
      const pageNumber = parseInt(page, 10);

      if (
        isNaN(limitNumber) ||
        limitNumber <= 0 ||
        isNaN(pageNumber) ||
        pageNumber <= 0
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Invalid limit or page number.",
          },
        });
      }

      const roleQuery = { role };

      const getRoleData = await db.roles.findOne(roleQuery);

      if (!getRoleData) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.DATA_NOT_FOUND,
          },
        });
      }

      const roleId = getRoleData._id;

      if (roleId) {
        const query = {
          role: roleId,
          $or: [
            { name: { $regex: search || "", $options: "i" } },
            { email: { $regex: search || "", $options: "i" } },
          ],
        };

        const sortBy = sort === "latest" ? { createdAt: -1 } : { createdAt: 1 };

        const skipNumber = (pageNumber - 1) * limitNumber;

        const getManagerList = await Users.find(query)
          .sort(sortBy)
          .skip(skipNumber)
          .limit(limitNumber)
          .populate("role");
        let total = getManagerList.length;
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.DATA_RETRIEVED_SUCCESSFULLY,
          data: getManagerList,
          total: total,
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: err.message || "Internal server error.",
        },
      });
    }
  },
  getAdminDetail: async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 401,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      const getAdminDetail = await Users.findById({
        _id: id,
      });
      if (getAdminDetail) {
        const properties = await Properties.find({
          addedBy: id,
          isDeleted: false,
        })
          .select("propertyTitle name propertyType city zipcode price images status")
          .lean();

        const propertiesByStatus = {
          sale: [],
          rent: [],
          directory: [],
        };

        properties.forEach((property) => {
          const normalizedType = property.propertyType || "sale";
          const bucket = propertiesByStatus[normalizedType] || propertiesByStatus.sale;
          bucket.push(mapPropertyForAdminDetail(property));
        });

        const payload = getAdminDetail.toObject ? getAdminDetail.toObject() : getAdminDetail;
        payload.partnerProperties = propertiesByStatus;
        payload.partnerPropertyCounts = {
          sale: propertiesByStatus.sale.length,
          rent: propertiesByStatus.rent.length,
          directory: propertiesByStatus.directory.length,
        };

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.DATA_RETRIVED_SUCCESSFULLY,
          payload,
        });
      } else {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.DATA_NOT_FOUND,
          },
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  getAllUsers: async (req, res) => {
    try {
      let { search, sortBy, page, count, status, role, country, amenities } =
        req.query;
      let query = {};
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      query.isDeleted = false;
      query.role = "user";
      if (role) {
        query.role = role;
      }
      if (status) {
        query.status = status;
      }
      if (country) {
        query.country = country;
      }
      if (amenities) {
        query["amenities._id"] =
          mongoose.Types.ObjectId.createFromHexString(amenities);
      }

      let sortquery = {};
      if (sortBy) {
        let [field, sortType] = sortBy.split(" ");
        sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1;
      }

      const pipeline = [
        // {
        //   $lookup: {
        //     from: "amenities",
        //     localField: "amenities",
        //     foreignField: "_id",
        //     as: "amenitiesDetails",
        //   },
        // },
        {
          $project: {
            id: "$_id",
            email: "$email",
            city: "$city",
            state: "$state",
            dialCode: "$dialCode",
            mobileNo: "$mobileNo",
            fullName: "$fullName",
            address: "$address",
            image: "$image",
            country: "$country",
            pinCode: "$pinCode",
            status: "$status",
            role: "$role",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            addedBy: "$addedBy",
            isDeleted: "$isDeleted",
            // amenities: "$amenitiesDetails",
            images: "$images",
          },
        },
        { $match: query },
        { $sort: sortquery },
      ];

      const total = await Users.countDocuments(query);

      if (page && count) {
        let skipNo = (Number(page) - 1) * Number(count);
        pipeline.push({ $skip: Number(skipNo) }, { $limit: Number(count) });
      }

      const result = await Users.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  getAllProUsers: async (req, res) => {
    try {
      let {
        search,
        sortBy,
        page,
        count,
        city,
        accountType,
        status,
        role,
        country,
        amenities,
        profileInPro,
      } = req.query;
      let query = {};
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { city: { $regex: search, $options: "i" } },
        ];
      }

      query.isDeleted = false;
      if (role) {
        // query.role = role;
        const rolename = role.split(",").map((id) => id);
        query.role = { $in: rolename };
      }
      if (city) {
        query.city = city;
      }
      if (status) {
        query.status = status;
      }
      if (country) {
        query.country = country;
      }
      if (amenities) {
        query["amenities._id"] =
          mongoose.Types.ObjectId.createFromHexString(amenities);
      }

      let sortquery = {};
      if (sortBy) {
        let [field, sortType] = sortBy.split(" ");
        sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1;
      }
      if (accountType) {
        query.accountType = accountType;
      }
      const pipeline = [
        {
          $lookup: {
            from: "properties",
            localField: "_id",
            foreignField: "addedBy",
            as: "propertyDetail",
          },
        },
        {
          $addFields: {
            rentCount: {
              $size: {
                $filter: {
                  input: "$propertyDetail",
                  as: "property",
                  cond: { $eq: ["$$property.propertyType", "rent"] },
                },
              },
            },
            saleCount: {
              $size: {
                $filter: {
                  input: "$propertyDetail",
                  as: "property",
                  cond: { $eq: ["$$property.propertyType", "sale"] },
                },
              },
            },
            offMarketCount: {
              $size: {
                $filter: {
                  input: "$propertyDetail",
                  as: "property",
                  cond: { $eq: ["$$property.propertyType", "offmarket"] },
                },
              },
            },
            DirectoryCount: {
              $size: {
                $filter: {
                  input: "$propertyDetail",
                  as: "property",
                  cond: { $eq: ["$$property.propertyType", "directory"] },
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "plans",
            localField: "planId",
            foreignField: "_id",
            as: "planDetails",
          }
        },
        {
          $project: {
            id: "$_id",
            firstName: "$firstName",
            lastName: "$lastName",
            fullName: "$fullName",
            companyName: "$companyName",
            email: "$email",
            password: "$password",
            verificationCode: "$verificationCode",
            dialCode: "$dialCode",
            image: "$image",
            address: "$address",
            city: "$city",
            street: "$street",
            state: "$state",
            country: "$country",
            pinCode: "$pinCode",
            mobileNo: "$mobileNo",
            registrationNumber: "$registrationNumber",
            companyRole: "$companyRole",
            isOnline: "$isOnline",
            amenities: "$amenities",
            images: "$images",
            doc_status: "$doc_status",
            addedType: "$addedType",
            addedBy: "$addedBy",
            isVerified: "$isVerified",
            docVerified: "$docVerified",
            permissions: "$permissions",
            role: "$role",
            accountType: "$accountType",
            status: "$status",
            stripe_subscriptionId: "$stripe_subscriptionId",
            property: "$property",
            propertyFor: "$propertyFor",
            isDeleted: "$isDeleted",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            coordinates: "$coordinates",
            otp: "$otp",
            servicesOffered: "$servicesOffered",
            companyLogo: "$companyLogo",
            coverImage: "$coverImage",
            website: "$website",
            tagline: "$tagline",
            about: "$about",
            companyContactNumber: "$companyContactNumber",
            companyEmail: "$companyEmail",
            openingHours: "$openingHours",
            servicesYouOffer: "$servicesYouOffer",
            closingHours: "$closingHours",
            deviceToken: "$deviceToken",
            unread_notifications_count: "$unread_notifications_count",
            rentCount: 1,
            saleCount: 1,
            offMarketCount: 1,
            DirectoryCount: 1,
            location: "$location",
            planDetails: 1,
          },
        },
        { $match: query },
        // { $sort: sortquery },
      ];

      if (profileInPro === "true") {
        pipeline.push({
          $match: {
            planDetails: {
              $elemMatch: {
                profileInPro: true
              },
            },
          },
        });
      }
      pipeline.push({ $sort: sortquery });

      // const total = await Users.countDocuments(query);
      const totalPipeline = [...pipeline, { $count: "count" }];
      const totalResult = await Users.aggregate(totalPipeline);
      const total = totalResult.length > 0 ? totalResult[0].count : 0;

      if (page && count) {
        let skipNo = (Number(page) - 1) * Number(count);
        pipeline.push({ $skip: Number(skipNo) }, { $limit: Number(count) });
      }

      const result = await Users.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  getPartnerPros: async (req, res) => {
    try {
      let {
        search,
        partnerType,
        sortBy,
        order,
        page,
        count,
        status,
        city,
        postalCode,
      } = req.query;

      const query = {
        accountType: "pro",
        isDeleted: false,
      };

      const orFilters = [];
      if (search) {
        const searchRegex = new RegExp(search, "i");
        orFilters.push({ fullName: { $regex: searchRegex } });
        orFilters.push({ email: { $regex: searchRegex } });
        orFilters.push({ city: { $regex: searchRegex } });
        orFilters.push({ pinCode: { $regex: searchRegex } });
        orFilters.push({ localFavoritePostalCodes: { $regex: searchRegex } });
      }

      if (postalCode) {
        const postalRegex = new RegExp(postalCode, "i");
        orFilters.push({ pinCode: { $regex: postalRegex } });
        orFilters.push({ localFavoritePostalCodes: postalCode });
      }

      if (orFilters.length > 0) {
        query.$or = orFilters;
      }

      if (status) {
        query.status = status;
      }
      if (city) {
        query.city = city;
      }
      if (partnerType === "global") {
        query.isGlobalFavorite = true;
      } else if (partnerType === "local") {
        query.isLocalFavorite = true;
      } else if (partnerType === "top") {
        query.isTopAgent = true;
      }

      const proIds = await Users.find(query).select("_id").lean();
      if (!proIds.length) {
        return res.status(200).json({ success: true, data: [], total: 0 });
      }

      const proObjectIds = proIds.map((pro) => pro._id);
      const [frCounts, enCounts] = await Promise.all([
        ProServiceFr.aggregate([
          { $match: { pro: { $in: proObjectIds }, status: { $ne: "deleted" } } },
          { $group: { _id: "$pro", count: { $sum: 1 } } },
        ]),
        ProServiceEn.aggregate([
          { $match: { pro: { $in: proObjectIds }, status: { $ne: "deleted" } } },
          { $group: { _id: "$pro", count: { $sum: 1 } } },
        ]),
      ]);

      const serviceCountMap = {};
      frCounts.forEach((item) => {
        const key = item._id.toString();
        serviceCountMap[key] = (serviceCountMap[key] || 0) + item.count;
      });
      enCounts.forEach((item) => {
        const key = item._id.toString();
        serviceCountMap[key] = (serviceCountMap[key] || 0) + item.count;
      });

      const partnerIds = Object.keys(serviceCountMap).map((id) =>
        mongoose.Types.ObjectId(id)
      );

      if (!partnerIds.length) {
        return res.status(200).json({ success: true, data: [], total: 0 });
      }

      query._id = { $in: partnerIds };
      const sortOrder = order === "asc" ? 1 : -1;
      const allowedSortFields = ["createdAt", "fullName", "email", "city"];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
      const sortquery = { [sortField]: sortOrder };

      const total = await Users.countDocuments(query);
      const skip = page && count ? (Number(page) - 1) * Number(count) : 0;
      const partners = await Users.find(query)
        .sort(sortquery)
        .skip(skip)
        .limit(Number(count || 10))
        .lean();

      const result = partners.map((partner) => ({
        ...partner,
        serviceCount: serviceCountMap[partner._id.toString()] || 0,
        topLabel: partner.isTopAgent ? getTopAgentLabel(partner.role) : null,
      }));

      return res.status(200).json({
        success: true,
        data: result,
        total,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + err,
        },
      });
    }
  },
  changePassword: async (req, res) => {
    try {
      const newPassword = req.body.newPassword;
      const currentPassword = req.body.currentPassword;
      const user = await Users.findById({
        _id: req.identity.id,
        isDeleted: false,
      });
      if (!bcrypt.compareSync(currentPassword, user.password)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.CURRENT_PASSWORD,
          },
        });
      } else {
        const password = await bcrypt.hashSync(
          newPassword,
          bcrypt.genSaltSync(10)
        );
        await Users.findByIdAndUpdate(user._id, {
          password: password,
        });
        let emailpayload = {
          email: user.email,
          fullName: user.fullName,
        };
        await Emails.changePasswordConfirmation(emailpayload);
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.PASSWORD_CHANGED,
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  forgotPasswordAdmin: async (req, res) => {
    try {
      if (!req.body.email || req.body.email == undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      var query = {};
      query.email = req.body.email.toLowerCase();
      query.isDeleted = false;
      const user = await Users.findOne(query);
      if (user.role == "admin" || user.role == "staff") {
        const verificationCode = await helper.generateVerificationCode(6);

        await Users.updateOne(
          {
            _id: user.id,
          },
          {
            verificationCode: verificationCode,
          }
        );

        let email_payload = {
          email: user.email,
          verificationCode: verificationCode,
          fullName: user.fullName,
          id: user.id,
          userId: user.id,
          time: new Date(),
          role: user.role,
        };

        await Emails.forgotPasswordEmail(email_payload);
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.VERIFICATION_CODE_SENT,
          id: user.id,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ACCOUNT_NOT_FOUND,
          },
        });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: err.toString(),
        },
      });
    }
  },
  forgotPasswordUser: async (req, res) => {
    try {
      if (!req.body.email || req.body.email == undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }

      var query = {};
      query.email = req.body.email.toLowerCase();
      query.isDeleted = false;

      const user = await Users.findOne(query);

      if (user) {
        const otp = await generateOTP();
        const verificationCode = await helper.generateVerificationCode(6);
        await Users.updateOne(
          {
            _id: user.id,
          },
          {
            otp: otp,
            verificationCode: verificationCode,
          }
        );

        let email_payload = {
          email: user.email,
          otp: otp,
          firstName: user.fullName,
          id: user.id,
          userId: user.id,
          time: new Date(),
          role: user.role,
          verificationCode: verificationCode,
        };
        await Emails.forgotPasswordEmailForUser(email_payload);
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.OTP_SENT,
          data: user.id,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ACCOUNT_NOT_FOUND,
          },
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: err.toString(),
        },
      });
    }
  },
  adminResetPassword: async (req, res) => {
    try {
      const id = req.body.id;

      if (!req.body.password || !req.body.verificationCode || !id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }

      const user = await Users.findById(id);

      if (
        user.verificationCode &&
        user.verificationCode != req.body.verificationCode
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.WRONG_VERIFICATION_CODE,
          },
        });
      } else if (!user.verificationCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.LINK_EXPIRED,
          },
        });
      } else {
        const password = await bcrypt.hashSync(
          req.body.password,
          bcrypt.genSaltSync(10)
        );
        await Users.updateOne(
          {
            _id: user.id,
          },
          {
            password: password,
            verificationCode: "",
          }
        );

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.PASSWORD_RESET,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: err.toString(),
        },
      });
    }
  },
  verifyOtp: async (req, res) => {
    try {

      let data = req.body;
      // console.log(data);
      if (!data.email && !data.otp && !data.type) {
        return res.status(200).json({
          success: false,
          message: constants.onBoarding.PAYLOAD_MISSING,
        });
      }
      let userData = await Users.findOne({ email: data.email, otp: data.otp });
      // console.log(userData);
      if (userData) {
        if (req.body.type == "login") {
          await Users.updateOne({ email: data.email }, { isVerified: "Y" });
          const password = await helper.generatePassword();
          const hashedPassword = await bcrypt.hashSync(password, bcrypt.genSaltSync(10));
          await Users.updateOne({ email: data.email }, { password: hashedPassword, });
          let data1 = await Users.findOne({ email: data.email });

          const defaultPlan = await db.plans.findOne({ planType: "free", isDeleted: false, status: "active" });
          if (defaultPlan) {
            await Users.updateOne({ email: data.email }, { planId: defaultPlan._id, planType: defaultPlan.planType, planDuration: "month" });
          }

          let email_payload = {
            email: data1.email,
            fullName: data1.fullName,
            password: password,
            role: data1.role,
          };
          await Emails.loginCredentialEmail(email_payload);

          var userInfo;
          userInfo = Object.assign({}, data1._doc);
          let token = jwt.sign(
            {
              id: data1.id,
              role: data1.role,
            },
            process.env.JWT_SECRET,
            {
              expiresIn: "3000h",
            }
          );
          userInfo.access_token = token;

          return res.status(200).json({
            success: true,
            data: userInfo,
            message: constants.onBoarding.OTP_MATCHED,
          });
        } else if (req.body.type == "forgot") {
          await Users.updateOne({ email: data.email }, { isVerified: true });
          let data1 = await Users.findOne({ email: data.email });
          return res.status(200).json({
            success: true,
            data: data1,
            message: constants.onBoarding.OTP_MATCHED,
          });
        }
      } else {
        return res.status(200).json({
          success: false,
          message: constants.onBoarding.INVALID_OTP,
        });
      }
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error,
        },
      });
    }
  },
  userResetPassword: async (req, res) => {
    try {
      const id = req.body.id;

      if (!req.body.password || !req.body.id || !req.body.verificationCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }

      let userData = await Users.findOne({
        _id: id,
        verificationCode: req.body.verificationCode,
      });
      if (userData) {
        const password = await bcrypt.hashSync(
          req.body.password,
          bcrypt.genSaltSync(10)
        );
        await Users.updateOne(
          {
            _id: userData.id,
          },
          {
            password: password,
          }
        );
        return res.status(200).json({
          success: true,
          message: "Password update successfully",
        });
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Invalid code",
          },
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: err.toString(),
        },
      });
    }
  },
  addUser: async (req, res) => {
    var date = new Date();
    try {
      const data = req.body;
        data.email = data.email.toLowerCase();
        // sanitize signupObjective: only keep allowed values, remove otherwise
        if (req.body.signupObjective && ALLOWED_SIGNUP_OBJECTIVES.includes(req.body.signupObjective)) {
          data.signupObjective = req.body.signupObjective;
        } else if (data.signupObjective) {
          delete data.signupObjective;
        }

      if (!req.body.email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      let query = {};
      query.isDeleted = false;
      query.email = req.body.email.toLowerCase();
      var user = await Users.findOne(query);

      if (user) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.EMAIL_EXIST,
          },
        });
      } else {
        data["date_registered"] = date;
        data["createdAt"] = date;
        data["updatedAt"] = date;
        data["status"] = "active";
        data["addedBy"] = req.identity.id;
        data["addedType"] = "admin";
        data["role"] = "user";
        var password = req.body.password;
        if (req.body.password) {
          data.password = await bcrypt.hashSync(
            req.body.password,
            bcrypt.genSaltSync(10)
          );
        } else {
          password = await helper.generatePassword();
          data.password = await bcrypt.hashSync(
            password,
            bcrypt.genSaltSync(10)
          );
        }

        data.isVerified = "Y";
        data.email = data.email.toLowerCase();

        if (req.body.firstName && req.body.lastName) {
          data["fullName"] = req.body.firstName + " " + req.body.lastName;
        }
        data.addedBy = req.identity.id ? req.identity.id : req.identity._id;

        let newUser = await Users.create(data);
        let settings_payload = {
          user_id: newUser.id,
          new_messages: {
            mail: true,
            phone: true,
          },
          property_profile: {
            mail: true,
            phone: true,
          },
          new_like: { phone: true },
          new_follow: { phone: true },
          new_share: {
            phone: true,
          },
          new_share_follow: {
            mail: true,
            phone: true,
          },
          new_status_update: {
            mail: true,
            phone: true,
          },
          new_key_update: {
            mail: true,
            phone: true,
          },
          new_blog_post: {
            mail: true,
            phone: true,
          },
          new_feature_release: {
            mail: true,
            phone: true,
          },
        };
        await db.setting.create(settings_payload);

        let email_payload = {
          email: newUser.email,
          fullName: newUser.fullName,
          password: password,
          role: newUser.role,
        };
        await Emails.addUserEmail(email_payload);

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.USER_ADDED,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "" + err,
      });
    }
  },
  deleteUser: async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.PAYLOAD_MISSING,
        });
      }
      const findUser = await Users.findOne({ _id: id });
      if (!findUser) {
        return res.status(404).json({
          success: false,
          message: constants.USER.NOT_FOUND,
        });
      }
      const query = {
        venue: findUser._id,
      };

      const deletedUser = await db.users.updateOne(
        {
          _id: id,
        },
        {
          isDeleted: true,
        }
      );
      if (deletedUser) {
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.USER_DELETED,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  addStaff: async (req, res) => {
    try {
      const data = req.body;
      var date = new Date();
      data.email = data.email.toLowerCase();
      if (!req.body.email) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: constants.onBoarding.PAYLOAD_MISSING },
        });
      }
      let query = {};
      query.isDeleted = false;
      query.email = req.body.email.toLowerCase();
      var user = await Users.findOne(query);
      if (user) {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.USER_EXIST,
        });
      } else {
        data["createdAt"] = date;
        data["updatedAt"] = date;
        data["status"] = "active";
        data["role"] = "staff";
        data["addedBy"] = req.identity.id;
        data["addedType"] = "admin";
        var password = req.body.password;
        if (req.body.password) {
          data.password = await bcrypt.hashSync(
            req.body.password,
            bcrypt.genSaltSync(10)
          );
        } else {
          password = await helper.generatePassword();
          data.password = await bcrypt.hashSync(
            password,
            bcrypt.genSaltSync(10)
          );
        }

        data.isVerified = "Y";
        data.email = data.email.toLowerCase();

        if (data.firstName && data.lastName) {
          data["fullName"] = data.firstName + " " + data.lastName;
        }
        data.addedBy = req.identity.id ? req.identity.id : req.identity._id;

        let newUser = await Users.create(data);

        let email_payload = {
          email: newUser.email,
          fullName: newUser.fullName,
          password: password,
          role: newUser.role,
        };
        await Emails.addStaffEmail(email_payload);
        return res.status(200).json({
          success: true,
          message: constants.STAFF.STAFF_ADDED,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  editStaffDetails: async (req, res) => {
    try {
      let data = req.body;
      let userData = await Users.findOne({ _id: data.id });
      if (userData) {
        if (req.body.firstName && req.body.lastName) {
          data["fullName"] = req.body.firstName + " " + req.body.lastName;
        }
        await Users.updateOne({ _id: userData._id }, data);
        return res.status(200).json({
          success: true,
          code: 200,
          message: constants.onBoarding.PROFILE_UPDATED,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: constants.onBoarding.ACCOUNT_NOT_FOUND,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  staffListing: async (req, res) => {
    try {
      let { search, sortBy, page, count, status, role, isVerified } = req.query;
      let query = {};
      if (search) {
        query.$or = [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      query.isDeleted = false;
      query.role = "staff";
      if (role) {
        query.role = role;
      }
      if (isVerified) {
        query.isVerified = isVerified;
      }
      if (status) {
        query.status = status;
      }

      let sortquery = {};
      if (sortBy) {
        let [field, sortType] = sortBy.split(" ");
        sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1;
      }

      const pipeline = [{ $match: query }, { $sort: sortquery }];

      const total = await Users.countDocuments(query);

      if (page && count) {
        let skipNo = (Number(page) - 1) * Number(count);
        pipeline.push({ $skip: Number(skipNo) }, { $limit: Number(count) });
      }

      const result = await Users.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  staffDetails: async (req, res) => {
    try {
      let staffId = req.query.id;
      let query = {};
      query._id = staffId;
      query.role = "staff";
      let staffData = await Users.findOne(query);
      if (staffData) {
        return res.status(200).json({
          success: true,
          data: staffData,
          message: constants.STAFF.DETAILS,
        });
      } else {
        return res.status(400).json({
          success: false,
          code: 400,
          message: constants.STAFF.NOT_EXIST,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  checkEmail: async function (req, res) {
    var email = req.query.email;
    if (!email || typeof email == undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: constants.onBoarding.PAYLOAD_MISSING,
        },
      });
    }
    const user = await Users.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });
    if (user) {
      return res.status(200).json({
        success: false,
        error: {
          code: 400,
          message: constants.onBoarding.EMAIL_TAKEN,
        },
      });
    } else {
      return res.status(200).json({
        success: true,
        message: constants.onBoarding.EMAIL_AVAILABLE,
      });
    }
  },
  inviteUser: async (req, res) => {
    var date = new Date();
    try {
      const data = req.body;

      if (!req.body.email || !req.body.fullName) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      let query = {};
      query.isDeleted = false;
      query.email = req.body.email.toLowerCase();
      var user = await Users.findOne(query);
      if (user) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.EMAIL_EXIST,
          },
        });
      } else {
        data["date_registered"] = date;
        data["createdAt"] = date;
        data["updatedAt"] = date;
        data["status"] = "active";
        data["role"] = req.body.role;
        data["type"] = req.body.type;
        data["addedBy"] = req.identity.id;
        var password = req.body.password;
        if (req.body.password) {
          data.password = await bcrypt.hashSync(
            req.body.password,
            bcrypt.genSaltSync(10)
          );
        } else {
          password = await generatePassword();
          data.password = await bcrypt.hashSync(
            password,
            bcrypt.genSaltSync(10)
          );
        }

        data.isVerified = "Y";
        data.email = data.email.toLowerCase();

        // if (req.body.firstName && req.body.lastName) {
        //   data["fullName"] = req.body.firstName + " " + req.body.lastName;
        // }
        data.addedBy = req.identity.id;
        // Create a user
        const user = new Users(data);

        // Save user in the database
        const newUser = await user.save(user);
        let findRole;
        if (newUser && newUser.role) {
          findRole = await db.roles.findById(newUser.role);
        }

        let email_payload = {
          email: newUser.email,
          fullName: newUser.fullName,
          password: password,
          role: findRole.name ? findRole.name : "",
          id: newUser.id,
          type: newUser.type,
        };
        await Emails.invite_user_email(email_payload);

        return res.status(200).json({
          success: true,
          data: newUser,
          message: constants.onBoarding.USER_INVITED,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        code: 400,
        message: "" + err,
      });
    }
  },


  logInSignUpSocialMedia: async (req, res) => {
    try {
      const data = req.body;

      if (!data.email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.EMAIL_REQUIRED,
          },
        });
      }

      if ((!data.firstName || !data.lastName) && !data.mobileNo) {
        return res.status(400).json({
          success: false,
          message: "FirstName and LastName are required if phone is not provided.",
        });
      }

      data.email = data.email.toLowerCase();

      const existingUser = await Users.findOne({
        email: data.email,
        isDeleted: false,
      });

      if (existingUser) {
        if (existingUser.isVerified === "N") {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: constants.onBoarding.USERNAME_VERIFIED,
            },
          });
        }

        // const token = jwt.sign(
        //   {
        //     id: existingUser.id,
        //     fullName: existingUser.fullName,
        //   },
        //   process.env.JWT_SECRET,
        //   { expiresIn: "200h" }
        // );

        // const refreshToken = jwt.sign(
        //   { id: existingUser.id },
        //   process.env.JWT_SECRET,
        //   { expiresIn: "200h" }
        // );

        // const userInfo = {
        //   ...existingUser._doc,
        //   access_token: token,
        //   refresh_token: refreshToken,
        //   alreadyRegistered: true,
        //   role: existingUser.role,
        // };

        // return res.status(200).json({
        //   success: true,
        //   message: constants.onBoarding.LOGIN_SUCCESS,
        //   data: userInfo,
        // });
        return res.status(400).json({
          success: false,
          message: "User exists. Please login"
        })
      } else {
        const date = new Date();
        data.date_registered = date;
        data.date_verified = date;
        data.status = "active";
        data.domain = "web";
        data.isVerified = "Y";
        data.mobileNo = data.mobileNo || "";
        data.fullName = `${data.firstName} ${data.lastName}`;

        const randomSuffix = Math.floor(Math.random() * 100000);
        let username = data.firstName[0].toUpperCase() + data.lastName[0].toUpperCase() + randomSuffix;
        let isUsernameUnique = false;

        while (!isUsernameUnique) {
          const existingUsername = await Users.findOne({
            isDeleted: false,
            username: username,
          });

          if (!existingUsername) {
            isUsernameUnique = true;
          } else {
            const randomExtra = Math.floor(Math.random() * 1000);
            username = username + randomExtra;
          }
        }

        data.username = username;

        const freePlan = await db.plans.findOne({
          planType: "free",
          isDeleted: false,
          status: "active",
        });

        if (freePlan) {
          data.planId = freePlan._id;
        }

        data.password = await helper.generatePassword();

        const createdUser = await Users.create(data);

        const token = jwt.sign(
          {
            id: createdUser._id,
            fullName: createdUser.fullName,
          },
          process.env.JWT_SECRET,
          { expiresIn: "200h" }
        );

        const refreshToken = jwt.sign(
          { id: createdUser._id },
          process.env.JWT_SECRET,
          { expiresIn: "200h" }
        );

        const emailPayload = {
          email: createdUser.email,
          fullName: createdUser.fullName,
          password: data.password,
          role: createdUser.role,
        };

        await Emails.loginCredentialEmail(emailPayload);

        const setting_payload = {
          user_id: createdUser.id,
          new_messages: { mail: true, phone: true },
          property_profile: { mail: true, phone: true },
          new_like: { phone: true },
          new_follow: { phone: true },
          new_share: { phone: true },
          new_share_follow: { mail: true, phone: true },
          new_status_update: { mail: true, phone: true },
          new_key_update: { mail: true, phone: true },
          new_blog_post: { mail: true, phone: true },
          new_feature_release: { mail: true, phone: true },
        };

        await db.setting.create(setting_payload);

        const userInfo = {
          ...createdUser._doc,
          alreadyRegistered: false,
          access_token: token,
          refresh_token: refreshToken,
          role: createdUser.role || "",
        };

        return res.status(200).json({
          success: true,
          message: constants.onBoarding.SUCCESSFULLY_REGISTERED,
          data: userInfo,
        });
      }
    } catch (error) {
      console.error("Social Login/Register Error:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "Internal Server Error: " + error,
        },
      });
    }
  },


  googleLoginAuthentication: async (req, res) => {
    try {
      let oAuth2Client = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: req.header("Referer")
          ? req.header("Referer") + "company"
          : process.env.GOOGLE_LOGIN_REDIRECT,
      });
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email",
        ],
        prompt: "consent",
      });
      return res.status(200).json({
        success: true,
        data: authUrl,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + err,
        },
      });
    }
  },
  googleLogin: async (req, res) => {
    try {
      let oAuth2Client = new OAuth2Client({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: req.header("Referer")
          ? req.header("Referer") + "company"
          : process.env.GOOGLE_LOGIN_REDIRECT,
      });
      const { tokens } = await oAuth2Client.getToken(req.query.authCode);
      const accessToken = tokens.access_token;
      // Set the access token obtained from the authorization step
      let oauth2Client = new google.auth.OAuth2(); // create new auth client
      oauth2Client.setCredentials({
        access_token: accessToken,
      }); // use the new auth client with the access_token
      let oauth2 = google.oauth2({
        auth: oauth2Client,
        version: "v2",
      });

      let { data } = await oauth2.userinfo.get();
      let userQuery = {};
      userQuery.isDeleted = false;
      userQuery.$or = [
        {
          googleLoginId: {
            $regex: data.id,
            $options: "i",
          },
        },
        {
          email: {
            $regex: data.email,
            $options: "i",
          },
        },
        // Add more fields as needed
      ];

      let user = await db.users
        .findOne(userQuery)
        .populate("role")
        .populate("subRole");

      if (user) {
        const token = jwt.sign(
          {
            id: user.id,
            role: user.role,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "3000h",
          }
        );
        var userdata;
        userdata = Object.assign({}, user._doc);
        userdata["access_token"] = token;
        const updatedUser = await db.users.updateOne(
          {
            _id: userdata.id,
          },
          {
            lastLogin: new Date(),
          }
        );
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.LOGIN_SUCCESS,
          data: userdata,
        });
      } else {
        let newUser = {};
        const date = new Date();
        newUser["status"] = "active";
        newUser["role"] = "64b15102b14de6c28838f7d2";
        newUser.firstName = data.given_name;
        newUser.lastName = data.family_name;
        if (data.name) {
          newUser.fullName = data.name;
        }
        const password = data.id;
        newUser.password = await bcrypt.hashSync(
          password,
          bcrypt.genSaltSync(10)
        );
        newUser.isVerified = "Y";
        newUser.createdAt = new Date();
        newUser.updatedAt = new Date();
        newUser.isDeleted = false;
        newUser.email = data.email.toLowerCase();
        newUser.googleLoginId = data.id;

        let createdUser = await db.users.create(newUser);
        var registeredUser = await Users.findById(
          createdUser.id ? createdUser.id : createdUser._id
        )
          .populate("role")
          .populate("subRole");
        const token = jwt.sign(
          {
            id: registeredUser.id,
            role: registeredUser.role,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "3000h",
          }
        );
        var userdata;
        userdata = Object.assign({}, registeredUser._doc);
        userdata["access_token"] = token;
        userdata["social_login"] = true;
        const updatedUser = await db.users.updateOne(
          {
            _id: userdata.id,
          },
          {
            lastLogin: new Date(),
          }
        );
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.LOGIN_SUCCESS,
          data: userdata,
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + err,
        },
      });
    }
  },
  sendVerificationOtp: async (req, res) => {
    try {
      if (!req.body.email) {
        return res.status(400).json({
          success: false,
          message: "Email required",
        });
      }
      let verificationOtp = await generateOTP();
      let userData = await Users.findOne({
        email: req.body.email,
        isDeleted: false,
      });
      if (userData) {
        let updatedUser = await Users.updateOne(
          {
            email: req.body.email,
          },
          {
            otp: verificationOtp,
          }
        );
        await Emails.verificationOtp({
          email: req.body.email,
          fullName: userData.fullName,
          otp: verificationOtp,
        });

        return res.status(200).json({
          success: true,
          message: "Verification otp sent of registered email.",
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "User not exist",
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + err,
        },
      });
    }
  },
  verifyForgotOtp: async (req, res) => {
    try {
      let data = req.body;
      let user = await db.users.findById(data.id);
      if (user) {
        if (user.verificationCode && user.verificationCode != data.otp) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: "Otp is incorrect.",
            },
          });
        } else if (!user.verificationCode) {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: "Otp is expired.",
            },
          });
        } else {
          let updatedUser = await db.users.updateOne(
            {
              _id: data.id,
            },
            {
              verificationCode: null,
            }
          );

          return res.status(200).json({
            success: true,
            id: user.id,
            message: "Otp verified successfully.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Invalid user.",
          },
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 500,
          message: "" + err,
        },
      });
    }
  },
  getAdminUsers: async (req, res) => {
    try {
      let { search, sortBy, page, count, status, role, country } = req.query;

      var query = {};
      if (search) {
        query.$or = [
          {
            fullName: {
              $regex: search,
              $options: "i",
            },
          },
          {
            email: {
              $regex: search,
              $options: "i",
            },
          },

          // Add more fields as needed
        ];
      }

      query.isDeleted = false;

      query.id = {
        $ne: mongoose.Types.ObjectId.createFromHexString(req.identity._id),
      };
      // // query.userType = "addByAdmin"
      query.loginPortal = {
        $eq: "admin",
      };
      if (role) {
        query.role = mongoose.Types.ObjectId.createFromHexString(role);
      }

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
      if (country) {
        query.country = country;
      }
      const pipeline = [
        {
          $lookup: {
            from: "roles",
            localField: "role",
            foreignField: "_id",
            as: "roleDetails",
          },
        },
        {
          $unwind: {
            path: "$roleDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            id: "$_id",
            userType: "$userType",
            email: "$email",
            city: "$city",
            state: "state",
            dialCode: "$dialCode",
            mobileNo: "$mobileNo",
            fullName: "$fullName",
            address: "$address",
            image: "$image",
            country: "$country",
            email: "$email",
            pinCode: "$pinCode",
            status: "$status",
            // role: "$role",
            role: "$roleDetails.name",
            roleId: "$roleDetails._id",
            loginPortal: "$roleDetails.loginPortal",
            currency: "$currency",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            addedBy: "$addedBy",
            isDeleted: "$isDeleted",
            previous_experience_desc: "$previous_experience_desc",
          },
        },
        {
          $match: query,
        },
        {
          $sort: sortquery,
        },
      ];

      const total = await Users.aggregate([...pipeline]);

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

      const result = await Users.aggregate([...pipeline]);

      return res.status(200).json({
        success: true,
        data: result,
        total: total.length,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },
  userRegister: async (req, res) => {
    try {
      const data = req.body;

      if (!req.body.email) {
        return res.status(400).json({
          success: false,
          error: { code: 400, message: constants.onBoarding.PAYLOAD_MISSING },
        });
      }

      const date = new Date();
      data["status"] = "active";
      data["role"] = req.body.role ? req.body.role : "user";
      // var password = req.body.password;

      // if (req.body.password) {
      //   data.password = await bcrypt.hashSync(
      //     req.body.password,
      //     bcrypt.genSaltSync(10)
      //   );
      // } else {
      //   password = await helper.generatePassword();
      //   data.password = await bcrypt.hashSync(password, bcrypt.genSaltSync(10));
      // }

      data.isVerified = "N";
      data.createdAt = new Date();
      data.updatedAt = new Date();
      data.isDeleted = false;
      data.email = data.email.toLowerCase();
      // sanitize signupObjective: only keep allowed values, remove otherwise
      if (req.body.signupObjective && ALLOWED_SIGNUP_OBJECTIVES.includes(req.body.signupObjective)) {
        data.signupObjective = req.body.signupObjective;
      } else if (data.signupObjective) {
        delete data.signupObjective;
      }
      const otp = await generateOTP();
      data.otp = otp;

      if (req.body.firstName && req.body.lastName) {
        data["fullName"] = req.body.firstName + " " + req.body.lastName;
      }

      var query = {};
      query.isDeleted = false;
      query.email = data.email;
      const existedUser = await Users.findOne(query);
      if (existedUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Email already exists in the application.",
          },
        });
      }
      const randomSuffix = Math.floor(Math.random() * 100000);
      let username = req.body.firstName[0].toUpperCase() + req.body.lastName[0].toUpperCase() + randomSuffix;
      let isUsernameUnique = false;

      while (!isUsernameUnique) {
        var usernameCheckQuery = { isDeleted: false, username: username };
        const existingUsername = await Users.findOne(usernameCheckQuery);

        if (!existingUsername) {
          isUsernameUnique = true;
        } else {
          const randomSuffix = Math.floor(Math.random() * 1000);
          username = username + randomSuffix;
        }
      }

      data.username = username;

      const createdUser = await Users.create(data);

      let setting_payload = {
        user_id: createdUser.id,
        new_messages: {
          mail: true,
          phone: true,
        },
        property_profile: {
          mail: true,
          phone: true,
        },
        new_like: { phone: true },
        new_follow: { phone: true },
        new_share: {
          phone: true,
        },
        new_share_follow: {
          mail: true,
          phone: true,
        },
        new_status_update: {
          mail: true,
          phone: true,
        },
        new_key_update: {
          mail: true,
          phone: true,
        },
        new_blog_post: {
          mail: true,
          phone: true,
        },
        new_feature_release: {
          mail: true,
          phone: true,
        },
      };

      await db.setting.create(setting_payload);

      let emailPayload = {
        email: createdUser.email,
        fullName: createdUser.fullName,
        otp: otp,
        id: createdUser.id,
        role: createdUser.role,
      };
      await Emails.userVerifyLink(emailPayload);

      // let email_payload = {
      //   email: data.email,
      //   fullName: data.fullName,
      //   password: password,
      //   role: data.role,
      // };

      let count_follow = await db.followUnfollow.countDocuments({
        user_id: createdUser.id,
      });

      let count_likes = await db.favorites.countDocuments({
        user_id: createdUser.id,
      });

      let folderCount = await db.folder.countDocuments({
        addedBy: createdUser.id,
        isDeleted: false,
      });

      let propertyInFolder = await db.folder.find({
        addedBy: createdUser.id,
        isDeleted: false,
      });

      let totalpropertiesInFolder = 0;
      if (propertyInFolder.length > 0) {
        for (let itm of propertyInFolder) {
          totalpropertiesInFolder =
            totalpropertiesInFolder + itm.property_id.length; // Corrected here
        }
      }

      const responseData = {
        ...createdUser.toObject(),
        _id: createdUser.id,
        id: createdUser.id,
        total_likes: count_likes,
        total_followers: count_follow,
        folderCount: folderCount,
        totalpropertiesInFolder: totalpropertiesInFolder,
      };

      // await Emails.loginCredentialEmail(email_payload);
      return res.status(200).json({
        success: true,
        message: "User registered successfully.Please verify your OTP.",
        data: responseData,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: {
          code: 400,
          message: "" + error,
        },
      });
    }
  },

  //get emiision value set by admin
  getQuaterlyEmissionValue: async (req, res) => {
    try {
      const find = await Users.findOne({ role: "admin" });
      if (!find.kwh) {
        return res.status(400).json({
          success: false,
          message: "Quaterly Emission Value Missing",
        })
      }
      let kwh = find.kwh;
      return res.json({
        success: true,
        data: {
          kwh: kwh
        }
      });
    }
    catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 400,
          message: "" + error,
        },
      });
    }
  },
  checkAccount: async (req, res) => {
    try {
      let data = req.body;
      // if(!email) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Email is missing",
      //   })
      // }
      if (!req.body.email || typeof req.body.email == undefined) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.EMAIL_REQUIRED,
          },
        });
      }
      let query = {};
      query.email = data.email.toLowerCase();
      query.isDeleted = false;
      const user = await Users.findOne(query);

      if (user && user.role === "admin") {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: constants.onBoarding.ONLY_USER_LOGIN,
          },
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: "User not found. Please sign-in first.",
          },
        });
      }

      if (user && user.status == "deactive") {
        return res.status(404).json({
          success: false,
          error: {
            code: 404,
            message: constants.onBoarding.USERNAME_INACTIVE,
          },
        });
      } else {
        const token = jwt.sign(
          {
            id: user._id,
            role: user.role,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "10h",
          }
        );
        // user["access_token"] = token
        let count_property = await db.property.countDocuments({
          addedBy: user.id,
        });
        let count_follow = await db.followUnfollow.countDocuments({
          user_id: user.id,
        });

        let count_likes = await db.favorites.countDocuments({
          user_id: user.id,
        });
        let folderCount = await db.folder.countDocuments({
          addedBy: user.id,
          isDeleted: false,
        });
        let propertyInFolder = await db.folder.find({
          addedBy: user.id,
          isDeleted: false,
        });
        let totalpropertiesInFolder = 0;
        if (propertyInFolder.length > 0) {
          for (let itm of propertyInFolder) {
            totalpropertiesInFolder =
              totalpropertiesInFolder + itm.property_id.length; // Corrected here
          }
        }
        let userData = Object.assign({}, user._doc);
        userData["access_token"] = token;
        userData["total_property"] = count_property;
        userData["isVerified"] = user.isVerified;
        userData["total_likes"] = count_likes;
        userData["total_followers"] = count_follow;
        userData.id = userData._id;
        userData.folderCount = folderCount;
        userData.totalpropertiesInFolder = totalpropertiesInFolder;
        if (data.deviceId) {
          let findDevice = await Devices.findOne({ deviceId: data.deviceId });
          if (findDevice) {
            if (
              findDevice.deviceToken != data.deviceToken ||
              findDevice.userId != userData._id
            ) {
              await Devices.updateOne(
                { _id: findDevice._id },
                {
                  deviceToken: data.deviceToken,
                  userId: userData._id,
                }
              );
            }
          } else {
            let insertData = {
              deviceId: data.deviceId,
              userId: userData._id,
              deviceToken: data.deviceToken,
            };
            await Devices.create(insertData);
          }
        }
        delete userData.password;
        return res.status(200).json({
          success: true,
          message: constants.onBoarding.LOGIN_SUCCESS,
          data: userData,
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Error occured during login",
        error: err.message,
      })
    }
  },
  sendMyPersonalData: async (req, res) => {
    try {
      const userId = req.query.id;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Id required"
        })
      }
      const findUser = await Users.findOne({ _id: userId, isDeleted: false });

      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "Email does not exists."
        })
      }
      let accountType = findUser.accountType;
      if (accountType == "individual") {
        let email_payload_individual = {
          firstName: findUser.firstName,
          lastName: findUser.lastName,
          email: findUser.email,
          images: findUser.images,
          city: findUser.city,
          street: findUser.street,
          state: findUser.state,
          country: findUser.country,
          pinCode: findUser.pinCode,
          mobileNo: findUser.mobileNo,
          username: findUser.username,
        };
        await Emails.SendPersonalDataIndividual(email_payload_individual);
      } else {
        let email_payload_pro = {
          firstName: findUser.firstName,
          lastName: findUser.lastName,
          email: findUser.email,
          images: findUser.images,
          city: findUser.city,
          street: findUser.street,
          state: findUser.state,
          country: findUser.country,
          pinCode: findUser.pinCode,
          mobileNo: findUser.mobileNo,
          username: findUser.username,
          companyRole: findUser.companyRole,
          companyName: findUser.companyName,
          companyEmail: findUser.companyEmail,
          companyContactNumber: findUser.companyContactNumber,
          website: findUser.website,
          coverImage: findUser.coverImage,
          companyLogo: findUser.companyLogo,
        }
        await Emails.SendPersonalDataPro(email_payload_pro);
      }
      return res.status(200).json({
        success: true,
        message: "Email sent successfully.",
      })
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },

  //2 step login of enabled by the user
  verificationLogin: async (req, res) => {
    try {
      let data = req.body;
      const { email, otp } = req.body;
      var query = {};
      query.email = email.toLowerCase();

      let user = await db.users.findOne(query);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Account not found."
        })
      }
      if (Number(otp) !== user.otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid otp"
        })
      }
      const token = jwt.sign(
        {
          id: user._id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "10h",
        }
      );
      // user["access_token"] = token
      let count_property = await db.property.countDocuments({
        addedBy: user.id,
      });
      let count_follow = await db.followUnfollow.countDocuments({
        user_id: user.id,
      });

      let count_likes = await db.favorites.countDocuments({
        user_id: user.id,
      });
      let folderCount = await db.folder.countDocuments({
        addedBy: user.id,
        isDeleted: false,
      });
      let propertyInFolder = await db.folder.find({
        addedBy: user.id,
        isDeleted: false,
      });
      let totalpropertiesInFolder = 0;
      if (propertyInFolder.length > 0) {
        for (let itm of propertyInFolder) {
          totalpropertiesInFolder =
            totalpropertiesInFolder + itm.property_id.length; // Corrected here
        }
      }
      let userData = Object.assign({}, user._doc);
      userData["access_token"] = token;
      userData["total_property"] = count_property;
      userData["isVerified"] = user.isVerified;
      userData["total_likes"] = count_likes;
      userData["total_followers"] = count_follow;
      userData.id = userData._id;
      userData.folderCount = folderCount;
      userData.totalpropertiesInFolder = totalpropertiesInFolder;
      if (data.deviceId) {
        let findDevice = await Devices.findOne({ deviceId: data.deviceId });
        if (findDevice) {
          if (
            findDevice.deviceToken != data.deviceToken ||
            findDevice.userId != userData._id
          ) {
            await Devices.updateOne(
              { _id: findDevice._id },
              {
                deviceToken: data.deviceToken,
                userId: userData._id,
              }
            );
          }
        } else {
          let insertData = {
            deviceId: data.deviceId,
            userId: userData._id,
            deviceToken: data.deviceToken,
          };
          await Devices.create(insertData);
        }
      }
      delete userData.password;
      return res.status(200).json({
        success: true,
        message: constants.onBoarding.LOGIN_SUCCESS,
        data: userData,
      });

    }
    catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }
  },


  //handle login history in case of session expire
  expireSession: async (req, res) => {
    try {
      const { userId, deviceId, deviceToken } = req.body;
      const findSession = await db.sessions.findOne({
        userId,
        deviceId,
        deviceToken
      });
      if (!findSession) {
        return res.status(200).json({
          success: true,
          message: " Saved Session not found",
        })
      }
      const updateSession = await db.sessions.updateOne({ userId, deviceId, deviceToken, isDeleted: false }, { LogoutTime: new Date(), status: "logged-out" });
      return res.status(200).json({
        success: true,
        message: "Session logged-out",
        data: {
          userId,
          status: updateSession.status,
          LogoutTime: updateSession.LogoutTime
        }
      })
    }
    catch (err) {
      return res.status(200).json({
        success: true,
        message: err.message,
      })
    }
  },

  sessionList: async (req, res) => {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "UserId required to perform the action"
        })
      }

      let findSession = await db.sessions.find({ userId, isDeleted: false });

      if (findSession.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No session found for the user"
        })
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched",
        data: findSession
      })
    }
    catch {
      return res.status(400).json({
        success: false,
        message: "Account login stats failed to fetch",
      })
    }
  },


  blockAnotherUser: async (req, res) => {
    try {
      const { blockTo, reason } = req.body;
      if (!blockTo) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }
      const findUser = await db.users.findOne({
        isDeleted: false,
        _id: blockTo
      })
      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User you want to block not found."
        })
      }

      const findBlockUser = await db.blockedUsers.findOne({
        // isDeleted: false,
        blockedBy: req.identity.id,
        blockedTo: blockTo
      })
      if (findBlockUser) {
        return res.status(400).json({
          success: false,
          message: `${findUser.fullName} has already been blocked by you.`
        })
      }
      if (blockTo === req.identity.id) {
        return res.status(400).json({
          success: false,
          message: "You cannot block yourself."
        })
      }

      const blockUser = await db.blockedUsers.create({
        blockedBy: req.identity.id,
        blockedTo: blockTo,
        reason
      })
      return res.status(200).json({
        success: false,
        message: `You have blocked ${findUser.fullName}`,
        data: blockUser._id
      })

    }
    catch (err) {
      return res.status(500).json({
        success: false,
        message: "Error occured while blocking this user.",
        error: err.message,
      })
    }
  },


  getBlockList: async (req, res) => {
    try {
      const { page = 1, count = 20, userId } = req.query;

      const pageNumber = parseInt(page);
      const pageSize = parseInt(count);
      const skipRecords = (pageNumber - 1) * pageSize;


      const blockedList = await db.blockedUsers
        .find({ blockedBy: userId })
        .populate("blockedBy", "fullName ")
        .populate("blockedTo", "fullName ")
        .sort({ createdAt: -1 })
        .skip(skipRecords)
        .limit(pageSize);

      const totalCount = await db.blockedUsers.countDocuments();

      // Respond with results
      res.status(200).json({
        success: true,
        data: blockedList,
        total: totalCount,
      });
    }
    catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to fetch users blocked by you.",
        error: err.message
      })
    }
  },

  activePlan: async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "UserId required"
        })
      }

      const findUser = await db.users.findOne({ _id: userId, isDeleted: false });
      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User not found."
        })
      }

      let planId = findUser.planId;
      let planType = findUser.planType;

      if (!planId) {
        return res.status(400).json({
          success: false,
          message: "You don't have any plan purchase a plan first."
        })
      }

      const findPlan = await db.plans.findOne({ _id: planId, isDeleted: false });
      if (!findPlan) {
        return res.status(400).json({
          success: false,
          message: "Plan doesn't exists."
        })
      }
      let planDuration = findUser.planDuration;
      let query = { isDeleted: false, _id: planId };
      const pipeline = [
        {
          $match: query,
        },
        {
          $lookup: {
            from: "features",
            localField: "feature",
            foreignField: "_id",
            as: "featureDetails",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "addedBy",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            selectedPricing: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$pricing",
                    as: "price",
                    cond: { $eq: ["$$price.interval", planDuration] } // Match interval with planDuration
                  }
                },
                0
              ]
            }
          }
        },
        {
          $project: {
            name: "$name",
            status: "$status",
            interval: "$interval",
            feature: "$featureDetails",
            monthlyPrice: "$monthlyPrice",
            yearlyPrice: "$yearlyPrice",
            interval: "$selectedPricing.interval",
            // pricing:{
            //   $filter: {
            //     input: "$pricing",
            //     as: "price",
            //     cond: { $eq: ["$$price.interval", planDuration] }
            //   }
            // },
            pricing: "$selectedPricing",
            planType: "$planType",
            role: "$role",
            otherDetails: "$otherDetails",
            isDeleted: "$isDeleted",
            createdAt: "$createdAt",
            updatedAt: "$updatedAt",
            numberOfProperty: "$numberOfProperty",
            numberOfInterest: "$numberOfInterest",
            dailyCampaignLimit: "$dailyCampaignLimit",
            weeklyCampaignLimit: "$weeklyCampaignLimit",
            monthlyCampaignLimit: "$monthlyCampaignLimit",
            leadsLevelOfFinanciabilityCheck: "$leadsLevelOfFinanciabilityCheck",
            numberLeadsLevelOfFinanciabilityCheck: "$numberLeadsLevelOfFinanciabilityCheck",
            offMarket: "$offMarket",
            messageToDirectoryOwners: "$messageToDirectoryOwners",
            messagesToOwners: "$messagesToOwners",
            numberOfProperty: "$numberOfProperty"
          },
        }
      ]
      const result = await db.plans.aggregate(pipeline);

      const [totalProperties, totalOffMarketProperties] = await Promise.all([
        db.property.countDocuments({
          addedBy: userId,
          isDeleted: false
        }),
        db.property.countDocuments({
          addedBy: userId,
          isDeleted: false,
          offMarket: true
        })
      ]);

      if (result.length > 0) {
        result[0].propertyCount = totalProperties;
        result[0].offMarketPropertyCount = totalOffMarketProperties;
      }
      return res.status(200).json({
        success: true,
        message: `You have ${findPlan.name} plan.`,
        data: result,
        // total: total,
      })
    }
    catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to get active plan for this user.",
        error: err.message,
      })
    }
  },

  getAllUserDocuments: async (req, res) => {
    try {
      let { type, search = '', page = 1, limit = 20 } = req.query;
      const userId = req.identity.id;
      const checkAdmin = await Users.findOne({ _id: userId, isDeleted: false })

      if (!checkAdmin || checkAdmin.role !== "admin") {
        return res.status(400).json({
          success: false,
          message: "You are unauthorized to access this data."
        })
      }

      const currentPage = Math.max(parseInt(page), 1);
      const perPage = Math.max(parseInt(limit), 1);
      const skip = (currentPage - 1) * perPage;

      const query = { isDeleted: false };
      if (search.trim()) {
        query.fullName = { $regex: new RegExp(search.trim(), 'i') };
      }

      const rawVerified = req.query.isDocumentVerified;
      if (rawVerified === 'true') {
        query.isDocumentVerified = true;
      } else if (rawVerified === 'false') {
        query.isDocumentVerified = false;
      }
      let projection = {
        _id: 1,
        fullName: 1,
        isDocumentVerified: 1,
        email: 1,
      };

      if (type === "document") {
        projection.renterFiles = 1;
        projection.buyerFiles = 1;
      } else if (type === "declarative") {
        projection.declarativeRenterFiles = 1;
        projection.declarativeBuyerFiles = 1;
      } else {
        projection.renterFiles = 1;
        projection.buyerFiles = 1;
        projection.declarativeRenterFiles = 1;
        projection.declarativeBuyerFiles = 1;
        projection.documentGrade = 1;
        projection.isDeclDocumentVerified = 1;
        projection.isDocumentVerified = 1;
      }
      const [users, total] = await Promise.all([
        Users.find(query, projection).skip(skip).limit(perPage).sort({ createdAt: -1 }),
        Users.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / perPage) || 1;

      return res.status(200).json({
        success: true,
        message: "User documents fetched successfully.",
        data: users,
        total,
      });

    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to get all users documents.",
        error: err.message
      })
    }
  },

  rateUserAndVerify: async (req, res) => {
    try {
      let { userId, documentGrade, isDocumentVerified, isDeclDocumentVerified, financingReferenceScore } = req.body;
      const allowedGrades = ['A', 'B', 'C', 'D', 'E', "Any"];
      const normalizedScore = financingReferenceScore != null ? Number(financingReferenceScore) : null;
      if (
        !userId ||
        !documentGrade ||
        isDocumentVerified === null ||
        isDeclDocumentVerified === null ||
        !allowedGrades.includes(documentGrade.toUpperCase()) ||
        (financingReferenceScore != null && (isNaN(normalizedScore) || normalizedScore < 0 || normalizedScore > 100))
      ) {
        return res.status(400).json({
          success: false,
          message: "UserId, valid documentGrades and optional financingReferenceScore between 0 and 100 are required."
        })
      }

      const findUser = await db.users.findOne({ _id: userId });

      if (!findUser) {
        return res.status(400).json({
          success: false,
          message: "User not found."
        })
      }

      let loggedUserId = req.identity.id;

      const findLoggedUser = await db.users.findOne({ _id: loggedUserId });

      if (findLoggedUser.role !== "admin") {
        return res.status(400).json({
          success: false,
          message: "You are unauthorized to perfrom this action."
        })
      }

      const updatePayload = {
        documentGrade: documentGrade,
        isDocumentVerified: isDocumentVerified,
        isDeclDocumentVerified
      };

      if (normalizedScore != null) {
        updatePayload.financingReferenceScore = normalizedScore;
        updatePayload.financingReferenceScoreUpdatedAt = new Date();
        updatePayload.financingReferenceScoreSource = (isDocumentVerified || isDeclDocumentVerified) ? "verified" : "admin";
      }

      await db.users.updateOne(
        { _id: userId, isDeleted: false },
        updatePayload
      )

      return res.status(200).json({
        success: true,
        message: "User verification done."
      })
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to get all users documents.",
        error: err.message
      })
    }
  },

  deleteUserByEmailPassword: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const user = await db.users.findOne({
        email: email,
        isDeleted: false,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User with this email does not exist",
        });
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (!isPasswordMatch) {
        return res.status(400).json({
          success: false,
          message: "Invalid password",
        });
      }

      await db.users.updateOne(
        { _id: user._id },
        { isDeleted: true }
      );

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message || "Internal server error",
      });
    }
  }
};
