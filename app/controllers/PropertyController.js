const db = require("../models");
const Property = db.property;
let mongoose = require("mongoose");
const constants = require("../utls/constants");
const csvParser = require("csv-parser");
const multer = require("multer");
const { sendEmail } = require("../config/brevo.config");
const {
  createObjectCsvStringifier
} = require("csv-writer");
const {
  Readable
} = require("stream");
const fs = require("fs");
const Emails = require("../Emails/onBoarding");
const { handleServerError } = require("../utls/helper");
const { formatDisplayName } = require("../utls/formatDisplayName");
const { STATUS } = require("../utls/enums");
const scoreService = require("../services/financialScore.service");
const logActivity = require("../services/activityLog.service");
const logPropertyActivity = require("../services/propertyActivityLog.service");
const statsService = require("../services/propertyStats.service");
const coordService = require("../services/propertyCoordinates.service");
const upload = multer({
  dest: "uploads/", // Destination folder
  limits: {
    fileSize: 10485760
  }, // 10 MB limit
}).single("file");
const string_toString_array = async (string) => {
  console.log(string, "string");
  if (string) {
    // console.log(string,"======string")
    let string_arr = string.split(",");
    let string_arr2 = [];
    for await (let item of string_arr) {
      string_arr2.push(item);
    }
    return string_arr2;
  }
  return [];
};

const parseCSV = (data) => {
  return new Promise((resolve, reject) => {
    const results = [];
    data
      .pipe(csvParser())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

const parseObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
};

/**
 * Determines the off-market access level for a given property and viewer.
 * Returns: 'accessible' | 'blurred_no_account' | 'blurred_no_project' | 'hidden'
 */
async function getOffMarketAccessLevel(property, loggedInUserId, userData) {
  if (!loggedInUserId || !userData) return 'blurred_no_account';
  const role = userData.role;
  if (role === 'admin' || role === 'staff') return 'accessible';
  // Owner always sees their own listing
  const ownerId = String(property.addedBy?._id || property.addedBy || '');
  if (ownerId && ownerId === String(userData._id)) return 'accessible';
  const isRent = String(property.propertyType || '').toLowerCase() === 'rent';
  // hasProject: user has actually computed their score via the declarative questionnaire.
  // We use the UpdatedAt timestamp as the indicator: it is only set when the score is
  // explicitly calculated. The score field itself defaults to 0 in the Mongoose schema,
  // so checking score != null would wrongly mark all newly-registered users as having a score.
  const hasProject = isRent
    ? (userData.renterFinancingReferenceScoreUpdatedAt != null)
    : (userData.financingReferenceScoreUpdatedAt != null);
  if (!hasProject) return 'blurred_no_project';
  const threshold = Number(property.chooseDocumentMinProbability ?? 0);
  let scoreResult;
  try {
    if (isRent) {
      scoreResult = await scoreService.computeRenterScore({
        declarativeRenterFiles: userData.declarativeRenterFiles || {},
        property,
      });
    } else {
      scoreResult = await scoreService.computeFinancialScore({
        declarativeBuyerFiles: userData.declarativeBuyerFiles || {},
        property,
      });
    }
  } catch (_e) {
    return 'blurred_no_project'; // fallback on compute error
  }
  const score = Number(scoreResult?.score ?? 0);
  return score >= threshold ? 'accessible' : 'hidden';
}

function filterByPrice(priceRange) {
  if (priceRange) {
    // Split price range into start and end prices
    let [startPrice, endPrice] = priceRange.split("-").map(Number);

    // Check that both startPrice and endPrice are valid numbers
    if (!isNaN(startPrice) && !isNaN(endPrice)) {
      return revenue_detail.filter((item) => {
        // Convert price to a number and check if it's within the range
        let price = Number(item.price);
        return price >= startPrice && price <= endPrice;
      });
    }
  }
  // Return the full array if no valid price filter is applied
  return revenue_detail;
}


// Helper function to process array fields (extract ObjectIds from stringified objects)
function processArrayField(fieldData) {
  try {
    let data = fieldData;
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    if (!Array.isArray(data)) {
      throw new Error('Must be an array.');
    }

    const ids = data.map(item => {
      if (typeof item === 'string' && mongoose.isValidObjectId(item)) {
        return item;
      }
      if (item && typeof item === 'object' && mongoose.isValidObjectId(item.id)) {
        return item.id;
      }
      return null;
    }).filter(id => id !== null);

    if (ids.length !== data.length) {
      throw new Error('Invalid ObjectId(s).');
    }
    return ids;
  } catch (err) {
    throw new Error(`Failed to process field: ${err.message}`);
  }
}

const GUEST_PROSPECT_IMAGES = [
  "abdullah-ali-1w9I6H4aftw-unsplash.jpg",
  "ahmet-sali-lqqpMXO_8Tc-unsplash.jpg",
  "alex-sheldon-0ncyUZzWqmQ-unsplash.jpg",
  "alex-sheldon-acRdRBYEZbM-unsplash.jpg",
  "alex-suprun-ZHvM3XIOHoE-unsplash.jpg",
  "andrey-k-Oj8GEnX5EMA-unsplash.jpg",
  "auston-mtabane-7Zn1SrNzyR8-unsplash.jpg",
  "christian-buehner-84E44EdD18o-unsplash.jpg",
  "christian-buehner-JQFHdpOKz2k-unsplash.jpg",
  "compagnons-a19OVaa2rzA-unsplash.jpg",
  "gift-habeshaw-k_R6MvBjtMM-unsplash.jpg",
  "gio-shravan-nMWqNf1r5TI-unsplash.jpg",
  "hannah-busing-ff5K3-kYPHA-unsplash.jpg",
  "jessica-felicio-_cvwXhGqG-o-unsplash.jpg",
  "jim-hatch--920_CMaW88-unsplash.jpg",
  "matthew-hamilton-tNCH0sKSZbA-unsplash.jpg",
  "nicolas-horn-MTZTGvDsHFY-unsplash.jpg",
  "seth-doyle-uJ8LNVCBjFQ-unsplash.jpg",
  "shahin-khalaji-qTMRoHOHu0U-unsplash.jpg",
  "sherise-van-dyk-X2OpvAPWSFE-unsplash.jpg"
];

const buildGuestProspectImage = (req, filename) => {
  const origin = process.env.BACK_WEB_URL || "http://localhost:6089";
  return encodeURI(`${origin}/assets/img/Prospect img/${filename}`);
};

const buildGuestUserLeads = (req, imageFiles) =>
  imageFiles.map((filename) => ({ profileImage: buildGuestProspectImage(req, filename) }));

const buildGuestPropertyImage = (req, filePath) => {
  const origin = process.env.BACK_WEB_URL || "http://localhost:6089";
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return encodeURI(`${origin}${path}`);
};

const buildGuestPropertyDetail = (req, id) => {
  const guestProperties = buildGuestProperties(req);
  const property = guestProperties.find((itm) => itm._id === id);
  if (!property) return null;
  return {
    ...property,
    sellerFiles: {
      identityProof: [
        {
          fileName: "guest-carte-didentite.pdf",
          originalname: "Carte d’identité",
          checked: true,
        },
      ],
      familySituation: [
        {
          fileName: "guest-certificat-situation-familiale.pdf",
          originalname: "Certificat de situation familiale",
          checked: true,
        },
      ],
      addressProof: [
        {
          fileName: "guest-justificatif-domicile-facture-edf.pdf",
          originalname: "Justificatif de domicile - facture EDF",
          checked: true,
        },
      ],
      carrezLaw: [
        {
          fileName: "guest-carrez-law-note.pdf",
          originalname: "Certificat Loi Carrez",
          checked: true,
        },
      ],
      technicalDiagnostic: [
        {
          fileName: "guest-diagnostic-technique.pdf",
          originalname: "Diagnostic technique",
          checked: true,
        },
      ],
      coOwnership: [
        {
          fileName: "guest-copropriete-reglement.pdf",
          originalname: "Règlement de copropriété",
          checked: true,
        },
      ],
      personalContribution: [
        {
          fileName: "guest-attestation-epargne-personnelle.pdf",
          originalname: "Attestation d’épargne personnelle",
          checked: true,
        },
      ],
      condominiumBooklet: [
        {
          fileName: "guest-carnet-copropriete.pdf",
          originalname: "Carnet de copropriété",
          checked: true,
        },
      ],
      minutesOfGeneral: [
        {
          fileName: "guest-assemblee-generale.pdf",
          originalname: "Procès-verbal d’assemblée générale",
          checked: true,
        },
      ],
      titleDeed: [
        {
          fileName: "guest-titre-de-propriete.pdf",
          originalname: "Titre de propriété",
          checked: true,
        },
      ],
      otherDocs: [
        {
          fileName: "guest-autres-documents.pdf",
          originalname: "Autres documents",
          checked: true,
        },
      ],
    },
  };
};

const buildGuestProperties = (req) => {
  const saleLeadFiles = GUEST_PROSPECT_IMAGES.slice(0, 10);
  const rentLeadFiles = GUEST_PROSPECT_IMAGES.slice(10, 20);
  return [
    {
      _id: "guest-prop-sale",
      propertyTitle: "Appartement 3 pièces - Paris 11e",
      address: "12 Rue de la Paix, Paris",
      propertyType: "sale",
      images: [{ file: buildGuestPropertyImage(req, "assets/img/spacejoy-4xRP0Ajk9ys-unsplash.jpg") }],
      totalLeads: 10,
      userImages: saleLeadFiles.slice(0, 3).map((filename) => buildGuestProspectImage(req, filename)),
      userLeads: buildGuestUserLeads(req, saleLeadFiles),
      visitBookedCount: 4,
      activityIndicatorCount: 2,
      interestUpdatedTime: new Date(),
      surface: "120",
      rooms: "4",
      bedrooms: "2",
      price: 890000,
      addedBy_details: {
        _id: "guest-owner-sale",
        firstName: "Sophie",
        lastName: "Martin",
        companyName: "ImmoPlus Conseil",
        accountType: "pro",
        image: buildGuestProspectImage(req, GUEST_PROSPECT_IMAGES[0]),
      },
    },
    {
      _id: "guest-prop-rent",
      propertyTitle: "Studio 28 m² - Lille Centre",
      address: "4 Rue de la Gare, Lille",
      propertyType: "rent",
      images: [{ file: buildGuestPropertyImage(req, "assets/img/spacejoy-85pCvDWDMmI-unsplash.jpg") }],
      totalLeads: 10,
      userImages: rentLeadFiles.slice(0, 3).map((filename) => buildGuestProspectImage(req, filename)),
      userLeads: buildGuestUserLeads(req, rentLeadFiles),
      visitBookedCount: 2,
      activityIndicatorCount: 1,
      interestUpdatedTime: new Date(),
      surface: "28",
      rooms: "1",
      bedrooms: "0",
      propertyMonthlyCharges: 2500,
      addedBy_details: {
        _id: "guest-owner-rent",
        firstName: "Thomas",
        lastName: "Dubois",
        companyName: "Gestion Locative Paris",
        accountType: "pro",
        image: buildGuestProspectImage(req, GUEST_PROSPECT_IMAGES[10]),
      },
    },
  ];
};

module.exports = {
  /**
   * GET /property/map-markers
   * Retourne un échantillon de biens répartis sur tout le territoire
   * pour affichage sur la carte. Utilise $sample pour la distribution.
   */
  /**
   * Fetch random map markers — prefers the lightweight property_coordinates collection
   * ($sample on tiny docs is O(1)), falls back to the full properties aggregation
   * if the coordinates collection is empty or missing.
   */
  _fetchMapMarkers: async (count) => {
    try {
      const markers = await coordService.getRandomMarkers(count);
      if (markers && markers.length > 0) {
        return markers.map(m => ({ ...m, exactLocation: true }));
      }
    } catch (_) { /* fall through */ }

    // Fallback: scan main collection
    const fallback = await db.property.aggregate([
      { $sample: { size: count * 5 } },
      { $project: {
          _id: 1, propertyTitle: 1, city: 1, zipcode: 1, price: 1, propertyType: 1,
          images: { $slice: ["$images", 1] },
          location: {
            lat: { $arrayElemAt: ["$newlocation.coordinates", 1] },
            lng: { $arrayElemAt: ["$newlocation.coordinates", 0] },
          },
          exactLocation: true,
      }},
      { $match: {
          isDeleted: false,
          'location.lat': { $nin: [null, 0] },
          'location.lng': { $nin: [null, 0] },
      }},
      { $limit: count },
    ]);
    return fallback;
  },

  mapMarkers: (() => {
    const cache = {};
    const cacheTime = {};
    const CACHE_TTL = 10 * 60 * 1000;

    const prefetch = async (count) => {
      const key = String(count);
      try {
        const markers = await module.exports._fetchMapMarkers(count);
        cache[key] = markers;
        cacheTime[key] = Date.now();
      } catch (e) {
        console.warn('[mapMarkers] prefetch error:', e.message);
      }
    };

    const handler = async (req, res) => {
      try {
        const count = Math.min(Number(req.query.count) || 500, 2000);
        const key = String(count);

        if (cache[key] && Date.now() - cacheTime[key] < CACHE_TTL) {
          return res.status(200).json({ success: true, data: cache[key] });
        }

        await prefetch(count);

        return res.status(200).json({ success: true, data: cache[key] || [] });
      } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
    };

    // Expose prewarm for startup cache warming
    handler.prewarm = prefetch;
    return handler;
  })(),

  add: async (req, res) => {
    const data = req.body;
    try {
      const now = new Date();

      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0, 0, 0, 0
      );

      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23, 59, 59, 999
      );

      data.addedBy = req.identity.id;
      const findAddedBy = await db.users.findOne({
        _id: req.identity.id,
        isDeleted: false
      }).populate('planId').select('otherDetails');
      if (!findAddedBy) {
        return res.status(400).json({
          success: false,
          message: "User adding property not found"
        })
      }

      const currentPropertCount = await db.property.countDocuments({
        addedBy: req.identity.id,
        isDeleted: false,
        // createdAt: {
        //   $gte: startOfMonth,
        //   $lte: endOfMonth,
        // }
      })

      //  console.log("currentPropertCount", currentPropertCount);
      //  console.log("findAddedBy.planId.numberOfProperty", findAddedBy.planId.numberOfProperty);

      if (findAddedBy.planId?.otherDetails.createPropProfileSaleRentDirectory.key === "custom") {
        if (currentPropertCount >= Number(findAddedBy.planId.otherDetails.createPropProfileSaleRentDirectory.value)) {
          return res.status(400).json({
            success: false,
            message: `Property limit reached. You can only add ${findAddedBy.planId.otherDetails.createPropProfileSaleRentDirectory.value} properties this month.`
          });
        }
      }


      if (findAddedBy.role === "admin" || findAddedBy.role === "staff") {
        data.importBy = "platform"
      } else {
        data.importBy = "user"
      }

      let property = await Property.create(data);
      if (data.linkedSchools && data.linkedSchools.length > 0) {
        for (let i = 0; i < data.linkedSchools.length; i++) {
          const schoolId = data.linkedSchools[i].schoolId;

          await db.schools.updateOne({
            _id: schoolId
          }, {
            $addToSet: {
              linkedProperties: {
                propertyId: property._id
              }
            }
          })
        }
      }

      if (data.completeDraft) {
        const deleteDraft = await db.draftProperty.deleteOne({
          addedBy: property.addedBy,
          propertyType: property.propertyType
        })
      }

      const owner = await db.users.findById(req.identity.id, 'fullName firstName lastName companyName').lean();
      const agencyName = owner?.companyName || [owner?.firstName, owner?.lastName].filter(Boolean).join(' ') || owner?.fullName || null;
      const createTimeline = await db.timeline.create({
        propertyId: property._id,
        addedBy: req.identity.id,
        type: "propertyCreated",
        meta: {
          statusBadge: property.propertyType || 'sale',
          price: data.price || null,
          agencyName,
        },
      })

      logActivity(req.identity.id, "property_create", { label: "Bien publié", objectType: "property", objectId: property._id, objectTitle: data.propertyTitle || "" });

      // Send property creation confirmation email to the owner (fire & forget)
      try {
        const owner = await db.users.findById(req.identity.id, 'email fullName firstName').lean();
        if (owner?.email) {
          const frontendUrl = process.env.FRONTEND_URL || 'https://app.anyhomes.fr';
          const typeLabel = property.propertyType === 'rent' ? 'Location' : property.propertyType === 'offmarket' ? 'Off-market' : 'Vente';
          sendEmail({
            to: [{ email: owner.email, name: owner.fullName || owner.firstName || '' }],
            templateId: constants.BREVO.PROPERTY_CREATED_CONFIRMATION,
            params: {
              ownerName: owner.fullName || owner.firstName || '',
              propertyTitle: property.propertyTitle || '',
              propertyType: typeLabel,
              managementUrl: `${frontendUrl}/real-estate-transaction-owner`,
            },
          }).catch(err => console.error('[Email] PROPERTY_CREATED_CONFIRMATION:', err.message));
        }
      } catch (emailErr) {
        console.error('[Email] PROPERTY_CREATED_CONFIRMATION setup:', emailErr.message);
      }

      // Fire-and-forget: update stats counter if property is active
      if (property.status === 'active') {
        statsService.increment(property);
        coordService.upsert(property);
      }

      return res.status(200).json({
        success: true,
        data: property,
        message: constants.PROPERTY.CREATED,
      });
    } catch (err) {
      console.log("ERROR:", err);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: err,
        },
      });
    }

  },

  details: async (req, res) => {
    try {
      let id = req.query.id;
      let userId = req.query.userId;
      const isGuestMockId = String(id || "").startsWith("guest-");
      const isGuestRequest = (["true", true, "1", 1].includes(req.query.guest) || isGuestMockId) && isGuestMockId;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.ID_MISSING,
        });
      }

      if (isGuestRequest) {
        const propertyDetail = buildGuestPropertyDetail(req, id);
        if (!propertyDetail) {
          return res.status(404).json({
            success: false,
            message: "Property not found.",
          });
        }

        const data = {
          propertyDetail,
          totalfollower: 0,
          totalProperty: 0,
          totallikes: 0,
          favourite_details: false,
          followunfollows_details: false,
          role: "guest",
          companyName: "Guest Property",
          ownerId: "guest-owner",
          isInterested: false,
          totalInquries: 0,
        };

        return res.status(200).json({
          success: true,
          data,
        });
      }

      // Ignore guest placeholder user IDs — skip DB lookups that would fail
      const GUEST_IDS = ['guest-user-000', '000000000000000000000000'];
      const isRealUser = userId && !GUEST_IDS.includes(String(userId));

      let isInterested = false;
      if (isRealUser) {
        const findUserInterest = await db.interests.findOne({
          buyerId: userId,
          propertyId: id,
          isDeleted: false
        });
        isInterested = !!findUserInterest;
      }

      console.log(isInterested);
      let propertyDetail = await Property.findOne({
        _id: id,
        isDeleted: false
      })
        .populate("amenities")
        .populate("equipment")
        .populate("outside")
        .populate("serviceAccessibility")
        .populate("ancilliary")
        .populate("environment")
        .populate("leisure")
        .populate("cooking")
        .populate("categories")
        .populate("agency")
        .populate("addedBy")
        .populate("propertyState")

      if (!propertyDetail) {
        return res.status(404).json({
          success: false,
          message: "Property not found.",
        });
      }

      // ─── Off-Market access control (detail page) ─────────────────────────
      if (propertyDetail.offMarket) {
        const viewerData = isRealUser
          ? await db.users.findOne({ _id: userId, isDeleted: false })
              .select('role _id declarativeBuyerFiles declarativeRenterFiles buyerFilesAddedAt renterFilesAddedAt financingReferenceScore renterFinancingReferenceScore')
              .lean()
          : null;
        const accessLevel = await getOffMarketAccessLevel(propertyDetail, userId, viewerData);
        if (accessLevel !== 'accessible') {
          const messages = {
            blurred_no_account: 'Ce bien Off-Market est réservé aux utilisateurs connectés.',
            blurred_no_project: 'Veuillez compléter votre formulaire « Votre projet » pour accéder aux biens Off-Market.',
            hidden: "Votre indice de fiabilité acquéreur / confiance locative est insuffisant pour accéder à ce bien Off-Market.",
          };
          return res.status(403).json({
            success: false,
            offMarketBlocked: true,
            reason: accessLevel,
            message: messages[accessLevel] || 'Accès refusé.',
          });
        }
      }

      let findOwner = await db.users.findOne({
        _id: propertyDetail.addedBy,
        isDeleted: false
      });
      if (
        isRealUser &&
        req.query.isVisit === "true" &&
        String(propertyDetail.addedBy._id) !== String(userId)
      ) {
        await db.property.updateOne(
          { _id: id },
          { $inc: { propertyViewerCount: 1 } }
        );
        logPropertyActivity(id, "profile_view", { userId, label: "Consultation du profil du bien" });
      }
      let totalProperty = await Property.countDocuments({
        isDeleted: false
      });
      let find_property = await db.followUnfollow.countDocuments({
        property_id: id,
        follow_unfollow: true,
      });
      propertyDetail = Object.assign({}, propertyDetail, {
        totalfollower: find_property,
      });

      let find_likes = await db.favorites.countDocuments({
        property_id: id,
        like: true,
      });
      let favourite_details = false;
      let followunfollows_details = false;
      if (userId) {
        const userObjectId = parseObjectId(userId);
        if (userObjectId) {
          let favouriteData = await db.favorites.findOne({
            property_id: id,
            user_id: userObjectId,
            like: true,
          });
          if (favouriteData) {
            favourite_details = true;
          }

          let followData = await db.followUnfollow.findOne({
            property_id: id,
            user_id: userObjectId,
            follow_unfollow: true,
          });
          if (followData) {
            followunfollows_details = true;
          }
        }
      }
      propertyDetail = Object.assign({}, propertyDetail, {
        totallikes: find_likes,
      });
      const findInqiries = await db.contactUs.countDocuments({ property_id: propertyDetail._id })
      let data = {};
      data.propertyDetail = propertyDetail._doc;
      data.totalfollower = propertyDetail.totalfollower;
      data.totalProperty = totalProperty;
      data.totallikes = propertyDetail.totallikes;
      data.favourite_details = favourite_details;
      data.followunfollows_details = followunfollows_details;
      if (data.propertyDetail.addedBy) {
        data.role = propertyDetail._doc.addedBy.role;
        data.propertyDetail.addedBy = data.propertyDetail.addedBy._id;
      }
      data.companyName = findOwner.companyName;
      data.ownerId = findOwner._id;
      data.ownerImage = findOwner.image || findOwner.companyLogo || findOwner.featuredProfilePhoto || propertyDetail._doc.addedBy?.image || null;
      data.ownerFirstName = findOwner.firstName || null;
      data.ownerLastName = findOwner.lastName || null;
      data.ownerFullName = findOwner.fullName || null;
      data.isInterested = isInterested;
      data.totalInquries = findInqiries;

      // ── Normalize location coordinates for frontend ─────────────────────
      // Frontend expects location.lat / location.lng, but MoteurImmo stores
      // coordinates as [lon, lat] arrays. Convert to the expected format.
      // Only set if not already present (no regression for existing properties).
      if (!data.propertyDetail.location?.lat && data.propertyDetail.newlocation?.coordinates) {
        const [lon, lat] = data.propertyDetail.newlocation.coordinates;
        data.propertyDetail.location = {
          ...(data.propertyDetail.location || {}),
          lat,
          lng: lon,
        };
        data.propertyDetail.exactLocation = true;
      } else if (!data.propertyDetail.location?.lat && data.propertyDetail.location?.coordinates) {
        const [lon, lat] = data.propertyDetail.location.coordinates;
        data.propertyDetail.location = { ...data.propertyDetail.location, lat, lng: lon };
        data.propertyDetail.exactLocation = true;
      }

      // ── Enrich with MoteurImmo external listing data ───────────────────
      if (data.propertyDetail.importBy === "platform") {
        const externalListing = await db.externalListing
          .findOne({ propertyId: id, source: "moteurimmo" })
          .lean();
        if (externalListing) {
          data.propertyDetail.source = "moteurimmo";
          data.propertyDetail.externalUrl = externalListing.raw?.url || null;
          data.propertyDetail.publisher = externalListing.raw?.publisher || null;

          // Fetch latest market exit reason from timeline
          const lastEvent = await db.timeline
            .findOne({ propertyId: id, type: "moteurimmoLeavingMarket" })
            .sort({ createdAt: -1 })
            .lean();
          if (lastEvent?.meta) {
            data.propertyDetail.moteurimmoStatusReason = lastEvent.meta.reason || null;
            data.propertyDetail.moteurimmoLastPrice = lastEvent.meta.lastPrice || null;
          }

        }
      }

      // Sollicitations composite metric
      const [solicitSoftOffers, solicitFormalOffers, solicitMessages, solicitPhoneReveals, solicitVisits] = await Promise.all([
        db.interests.countDocuments({ propertyId: id, isDeleted: false, interestType: "interest sent" }),
        db.interests.countDocuments({ propertyId: id, isDeleted: false, interestType: "offer sent" }),
        db.messages.countDocuments({ property_id: id, isDeleted: false }),
        db.propertyActivityLog.countDocuments({ propertyId: id, type: "profile_view", phoneRevealed: true }),
        db.propertyActivityLog.countDocuments({ propertyId: id, type: "visit_request" }),
      ]);
      data.solicitations = {
        total: solicitSoftOffers + solicitFormalOffers + solicitMessages + solicitPhoneReveals + solicitVisits,
        interests: solicitSoftOffers + solicitFormalOffers,
        softOffers: solicitSoftOffers,
        formalOffers: solicitFormalOffers,
        messages: solicitMessages,
        phoneReveals: solicitPhoneReveals,
        bookedVisits: solicitVisits,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error.message,
        },
      });
    }
  },

  /**
   * Lightweight count-only endpoint — used by the filter modal preview.
   * Reuses the property_stats cache (O(1)) for simple city/total queries,
   * falls back to countDocuments for complex filters (no pipeline, no find).
   */
  count: async (req, res) => {
    try {
      const {
        search,
        status,
        propertyType,
        minPrice,
        maxPrice,
        minSurface,
        maxSurface,
        type,
        rooms,
        bedrooms,
        offMarket,
        proposal,
        energy_efficient,
        propertyFloor,
        cooking,
        equipment,
        serviceAccessibility,
        outside,
        environment,
        leisure,
        ancilliary,
        investment,
        schoolId,
        schoolType,
        accountType,
        addedBy,
      } = req.query;

      const query = { isDeleted: false };
      if (status) query.status = status;

      let textCity = null;
      if (search) {
        const searchTerms = search.split(' / ').map((t) => t.trim());
        const textQuery = searchTerms
          .map((term) => term.split(',')[0].trim() || term)
          .join(' ');
        query.$text = { $search: textQuery };
        // Single location → candidate for city stats cache
        if (searchTerms.length === 1) {
          textCity = searchTerms[0].split(',')[0].trim().toLowerCase();
        }
      }

      if (propertyType) query.propertyType = propertyType;
      if (offMarket === 'true') query.offMarket = true;
      if (proposal) query.proposal = proposal;
      if (energy_efficient) query.energy_efficient = energy_efficient;
      if (accountType) query.accountType = accountType;
      if (addedBy) {
        const id = addedBy.match(/^[0-9a-fA-F]{24}$/) ? require('mongoose').Types.ObjectId(addedBy) : null;
        if (id) query.addedBy = id;
      }
      if (type) {
        const types = type.split(',').map((t) => new RegExp(t.trim(), 'i'));
        query.type = { $in: types };
      }
      if (rooms) query.rooms = { $in: rooms.split(',').map(String) };
      if (bedrooms) query.bedrooms = { $in: bedrooms.split(',').map(String) };
      if (propertyFloor) query.propertyFloor = { $in: propertyFloor.split(',').map(String) };
      if (cooking) query.cooking = { $in: cooking.split(',').map((s) => s.trim()) };
      if (equipment) query.equipment = { $in: equipment.split(',').map((s) => s.trim()) };
      if (serviceAccessibility) query.serviceAccessibility = { $in: serviceAccessibility.split(',').map((s) => s.trim()) };
      if (outside) query.outside = { $in: outside.split(',').map((s) => s.trim()) };
      if (environment) query.environment = { $in: environment.split(',').map((s) => s.trim()) };
      if (leisure) query.leisure = { $in: leisure.split(',').map((s) => s.trim()) };
      if (ancilliary) query.ancilliary = { $in: ancilliary.split(',').map((s) => s.trim()) };
      if (minPrice || maxPrice) {
        const pf = {};
        if (!isNaN(minPrice) && minPrice) pf.$gte = Number(minPrice);
        if (!isNaN(maxPrice) && maxPrice) pf.$lte = Number(maxPrice);
        if (Object.keys(pf).length) query.price = pf;
      }
      if (minSurface || maxSurface) {
        const sf = {};
        if (!isNaN(minSurface) && minSurface) sf.min = Number(minSurface);
        if (!isNaN(maxSurface) && maxSurface) sf.max = Number(maxSurface);
        if (Object.keys(sf).length) {
          query.$expr = {
            $and: [
              sf.min !== undefined ? { $gte: [{ $toDouble: '$surface' }, sf.min] } : {},
              sf.max !== undefined ? { $lte: [{ $toDouble: '$surface' }, sf.max] } : {},
            ].filter(Boolean),
          };
        }
      }

      // ── Stats cache fast-paths ────────────────────────────────────────────
      const qKeys = Object.keys(query);
      const isSimpleActive =
        qKeys.length === 2 &&
        query.isDeleted === false &&
        query.status === 'active';

      // City-only: { isDeleted, status, $text } with no other filters
      const isCityOnly =
        textCity &&
        qKeys.length === 3 &&
        query.isDeleted === false &&
        query.status === 'active' &&
        query.$text;

      // City + propertyType: { isDeleted, status, $text, propertyType }
      const isCityAndType =
        textCity &&
        query.propertyType &&
        qKeys.length === 4 &&
        query.isDeleted === false &&
        query.status === 'active' &&
        query.$text;

      let total;
      if (isSimpleActive) {
        const cached = await statsService.getTotal();
        total = cached !== null ? cached : await Property.countDocuments(query);
      } else if (isCityAndType) {
        const cached = await statsService.getCount(`city:${textCity}|type:${query.propertyType}`);
        total = cached !== null ? cached : await Property.countDocuments(query);
      } else if (isCityOnly) {
        const cached = await statsService.sumByPrefix(`city:${textCity}`);
        total = cached !== null ? cached : await Property.countDocuments(query);
      } else {
        total = await Property.countDocuments(query);
      }

      return res.status(200).json({ success: true, total });
    } catch (err) {
      console.error('[property/count] error:', err.message);
      return res.status(500).json({ success: false, message: 'Count failed' });
    }
  },

  listing: async (req, res) => {
    try {
      let {
        search,
        rooms,
        page = 1,
        accountType,
        follow_unfollow,
        count,
        sortBy,
        address,
        status,
        minSurface,
        maxSurface,
        categories,
        agencyId,
        type,
        propertyType,
        addedBy,
        userId,
        amenities,
        minPrice,
        maxPrice,
        energy_efficient,
        propertyFloor,
        bedrooms,
        favourites,
        cooking,
        equipment,
        serviceAccessibility,
        outside,
        add_more_step,
        contact,
        environment,
        leisure,
        ancilliary,
        investment,
        situation,
        userLng,
        userLat,
        maxDistance,
        request_status,
        proposal,
        nameSearch,
        schoolId,
        schoolType,
        schoolStatus,
        offMarket,
        loggedInUser,
        schoolName,
        cursor,
      } = req.query;
      const pageNumber = Number(page) || 1;
      let pageSize = Number(count) || 20;
      if (pageSize <= 0) pageSize = 20;
      if (pageSize > 100) pageSize = 100;

      // Guest mode: return mock properties only for /my-properties (addedBy=guest-user-000)
      // Do NOT use guest headers here — they are sent on ALL requests including /properties (search)
      const isGuestListing = addedBy === "guest-user-000";
      if (isGuestListing) {
        const guestProps = buildGuestProperties(req);
        return res.json({ success: true, data: guestProps, total: guestProps.length });
      }

      var query = {};
      if (agencyId) {
        const agencyObjectId = parseObjectId(agencyId);
        if (agencyObjectId) {
          query.agency = agencyObjectId;
        }
      }

      // let loggedInUserId = req.identity.id;
      if (search) {
        const searchTerms = search.split(" / ").map((term) => term.trim());

        // Use $text search for performance (uses the text index on city/address/state/country/zipcode)
        // Extract the city part (before first comma) for each term to avoid false positives from "France"
        const textQuery = searchTerms.map((term) => {
          const cityPart = term.split(",")[0].trim();
          return cityPart || term;
        }).join(" ");

        query.$text = { $search: textQuery };
      }
      if (nameSearch) {
        query.propertyTitle = {
          $regex: nameSearch,
          $options: 'i'
        };
      }
      query.isDeleted = false;
      var sortquery = {};
      if (type) {
        type = await string_toString_array(type);
        const regexPattern = type.map((type) => new RegExp(type, "i"));
        query.type = {
          $in: regexPattern
        };
      }
      if (rooms) {
        const roomsArray = rooms.split(',').map(String);
        query.rooms = {
          $in: roomsArray
        };
      }
      if (bedrooms) {
        const bedroomsArray = bedrooms.split(',').map(String);
        query.bedrooms = {
          $in: bedroomsArray
        };
      }
      if (energy_efficient) {
        query.energy_efficient = energy_efficient;
      }

      if (minSurface || maxSurface) {
        const surfaceFilter = {};
        if (!isNaN(minSurface)) {
          surfaceFilter.min = Number(minSurface); //  minSurface is numeric
        }
        if (!isNaN(maxSurface)) {
          surfaceFilter.max = Number(maxSurface); //  maxSurface is numeric
        }

        if (Object.keys(surfaceFilter).length) {
          query.$expr = {
            $and: [
              surfaceFilter.min !== undefined ? {
                $gte: [{
                  $toDouble: "$surface"
                }, surfaceFilter.min]
              } : {},
              surfaceFilter.max !== undefined ? {
                $lte: [{
                  $toDouble: "$surface"
                }, surfaceFilter.max]
              } : {},
            ].filter(Boolean),
          };
        }
      }

      if (minPrice || maxPrice) {
        const priceFilter = {};
        if (!isNaN(minPrice)) {
          priceFilter.$gte = Number(minPrice);
        }
        if (!isNaN(maxPrice)) {
          priceFilter.$lte = Number(maxPrice);
        }
        if (Object.keys(priceFilter).length) {
          query.price = priceFilter;
        }
      }
      if (sortBy) {
        let [field, sortType] = sortBy.split(" ");
        sortquery[field ? field : "createdAt"] = sortType === "desc" ? -1 : 1;
      } else {
        sortquery.createdAt = -1;
      }
      if (status) {
        query.status = status;
      }
      if (request_status) {
        query.request_status = request_status;
      }
      if (categories) {
        const categoryId = parseObjectId(categories);
        if (categoryId) {
          query.categories = categoryId;
        }
      }
      if (propertyType) {
        query.propertyType = propertyType;
      }
      if (accountType) {
        query.accountType = accountType;
      }
      if (follow_unfollow) {
        if (follow_unfollow == "true") {
          query.followunfollows_details = true;
        } else if (follow_unfollow == "false") {
          query.followunfollows_details = false;
        }
      }
      if (favourites) {
        if (favourites == "true") {
          query.favourite_details = true;
        } else if (favourites == "false") {
          query.favourite_details = false;
        }
      }
      if (add_more_step) {
        if (add_more_step == "true") {
          query.add_more_step = true;
        } else if (add_more_step == "false") {
          query.add_more_step = false;
        }
      }
      if (contact === "true") {
        query.contact = true;
      }
      if (addedBy) {
        const addedById = parseObjectId(addedBy);
        if (addedById) {
          query.addedBy = addedById;
        }
      }
      if (address) {
        address = await string_toString_array(address);
        const regexPattern = address.map((type) => new RegExp(type, "i"));
        query.address = {
          $in: regexPattern
        };
      }
      if (amenities) {
        amenities = amenities
          .split(",")
          .map((id) => parseObjectId(id.trim()))
          .filter(Boolean);
        if (amenities.length) {
          query.amenities = {
            $in: amenities
          };
        }
      }
      if (cooking) {
        let cookingArray = cooking.split(",").map(id => id.trim());

        query.cooking = {
          $in: cookingArray
        };
      }
      if (equipment) {
        const equipmentArray = equipment.split(",").map((id) => (id.trim()));
        query.equipment = {
          $in: equipmentArray
        };
      }
      if (serviceAccessibility) {
        const serviceAccessibilityArray = serviceAccessibility.split(",").map((id) => (id.trim()));
        query.serviceAccessibility = {
          $in: serviceAccessibilityArray
        };
      }
      if (outside) {
        const outsideArray = outside.split(",").map((id) => (id.trim()));
        query.outside = {
          $in: outsideArray
        };
      }
      if (environment) {
        const environmentArray = environment.split(",").map((id) => (id.trim()));
        query.environment = {
          $in: environmentArray
        };
      }
      if (leisure) {
        const leisureArray = leisure.split(",").map((id) => (id.trim()));
        query.leisure = {
          $in: leisureArray
        };
      }
      if (ancilliary) {
        const ancilliaryArray = ancilliary.split(",").map((id) => (id.trim()));
        query.ancilliary = {
          $in: ancilliaryArray
        };
      }
      if (investment) {
        investment = await string_toString_array(investment);
        const regexPattern = investment.map((type) => new RegExp(type, "i"));
        query.investment = {
          $in: regexPattern
        };
      }
      if (situation) {
        situation = await string_toString_array(situation);
        const regexPattern = situation.map((type) => new RegExp(type, "i"));
        query.situation = {
          $in: regexPattern
        };
      }
      let userIdObj;
      if (userId) {
        const parsedUserId = parseObjectId(userId);
        if (parsedUserId) {
          userIdObj = parsedUserId;
        }
      }
      if (maxDistance) {
        maxDistance = Number(maxDistance);
      }
      if (propertyFloor) {
        const propertyFloorArray = propertyFloor.split(',').map(String);
        query.propertyFloor = {
          $in: propertyFloorArray
        };
      }
      if (proposal) {
        query.proposal = proposal;
      }

      if (offMarket === "true") {
        // Toggle ON: show only Off-Market properties
        query.offMarket = true;
      }
      // Toggle OFF or absent: no filter → show all properties (normal + off-market)
      ///
      let loggedInUserData;
      let financingProbabilityMatch = {};
      let noOffMarketAccess = false;
      let dynamicRentFiltering = false;
      let loggedInUserDeclarativeRenterFiles = {};
      if (loggedInUser) {
        loggedInUserData = await db.users.findOne({
          _id: loggedInUser
        }).lean();
        if (loggedInUserData) {
          // Use -1 when score is not yet calculated so that even threshold=0 ("Tout le monde")
          // requires a computed buyer score — users with no score are excluded from all off-market listings.
          // We use UpdatedAt as the real indicator: the score field defaults to 0 in Mongoose schema,
          // so checking != null would wrongly treat all new users as having a calculated score.
          const hasCalculatedSaleScore = loggedInUserData?.financingReferenceScoreUpdatedAt != null;
          const userSaleScore = hasCalculatedSaleScore ? Number(loggedInUserData.financingReferenceScore) : -1;
          const userRole = loggedInUserData?.role;
          const isAdminUser = userRole === "admin" || userRole === "staff";

          if (offMarket === "true" && !isAdminUser) {
            const saleThreshold = hasCalculatedSaleScore ? Math.min(100, Math.max(0, userSaleScore)) : -1;
            financingProbabilityMatch = {
              $or: [
                { addedBy: loggedInUser },
                {
                  $and: [
                    { propertyType: { $ne: "rent" } },
                    { chooseDocumentMinProbability: { $lte: saleThreshold } },
                  ],
                },
                {
                  $and: [
                    { propertyType: "rent" },
                  ],
                },
              ],
            };
            dynamicRentFiltering = true;
            loggedInUserDeclarativeRenterFiles = loggedInUserData?.declarativeRenterFiles || {};
          }
        } else if (offMarket === "true") {
          noOffMarketAccess = true;
        }
      } else if (offMarket === "true") {
        noOffMarketAccess = true;
      }

      ///
      // Early pagination setup: only the current page's documents go through expensive $lookup stages
      const skipNo = (pageNumber - 1) * pageSize;
      const earlyPaginate = !dynamicRentFiltering && !schoolStatus && !schoolName;
      const schoolTypeArray = schoolType ? schoolType.split(",").map(type => type.trim()) : [];
      const schoolIdArray = schoolId
        ? schoolId.split(",").map(id => parseObjectId(id.trim())).filter(Boolean)
        : [];

      const pipeline = [
        {
          $match: {
            ...query,
            ...(noOffMarketAccess ? { _id: null } : {}),
            ...financingProbabilityMatch,
            ...(schoolTypeArray.length ? { "linkedSchools.type": { $in: schoolTypeArray } } : {}),
            ...(schoolIdArray.length ? { "linkedSchools.schoolId": { $in: schoolIdArray } } : {}),
          },
        },
        // Sort + paginate EARLY so only pageSize documents go through all the $lookup stages below
        ...(earlyPaginate ? [
          { $sort: sortquery },
          { $skip: Number(skipNo) },
          { $limit: Number(pageSize) },
        ] : []),
        // {
        //   $geoNear: {
        //     near: {
        //       type: "Point",
        //       coordinates: [Number(userLng), Number(userLat)],
        //     },
        //     distanceField: "distance",
        //     spherical: true,
        //     ...(maxDistance ? { maxDistance: maxDistance } : {}),
        //   },
        // },
        {
          $lookup: {
            from: "interests",
            localField: "_id",
            foreignField: "propertyId",
            as: "interestDetails"
          }
        },
        {
          $addFields: {
            totalLeads: {
              $size: "$interestDetails"
            }
          }
        },
        {
          $lookup: {
            from: "amenities",
            localField: "amenities",
            foreignField: "_id",
            as: "amenitiesDetails",
          },
        },

        {
          $lookup: {
            from: "categories",
            localField: "categories",
            foreignField: "_id",
            as: "categoriesDetails",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "agency",
            foreignField: "_id",
            as: "agencyDetails",
          },
        },

        // Removed heavy lookups for likedUsers and followUsers to improve listing performance

        {
          $lookup: {
            from: "users",
            localField: "addedBy",
            foreignField: "_id",
            as: "addedBy_details",
          },
        },

        {
          $unwind: {
            path: "$addedBy_details",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "favorites",
            let: {
              property_id: "$_id",
              user_id: userIdObj
            },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                    $eq: ["$property_id", "$$property_id"]
                  },
                  {
                    $eq: ["$user_id", "$$user_id"]
                  },
                  ],
                },
              },
            },],
            as: "favourite_details",
          },
        },
        {
          $unwind: {
            path: "$favourite_details",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "followunfollows",
            let: {
              property_id: "$_id",
              user_id: userIdObj
            },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                    $eq: ["$property_id", "$$property_id"]
                  },
                  {
                    $eq: ["$user_id", "$$user_id"]
                  },
                  ],
                },
              },
            },],
            as: "followunfollows_details",
          },
        },
        {
          $unwind: {
            path: "$followunfollows_details",
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "messages",
            let: {
              property_id: "$_id",
              status: "unread"
            },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                    $eq: ["$property_id", "$$property_id"]
                  },
                  {
                    $eq: ["$status", "$$status"]
                  },
                  ],
                },
              },
            },],
            as: "new_messages",
          },
        },

        {
          $lookup: {
            from: "favorites",
            let: {
              property_id: "$_id"
            },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                    $eq: ["$property_id", "$$property_id"]
                  },
                  {
                    $eq: ["$like", true]
                  },
                  ],
                },
              },
            },
            {
              $count: "likeCount",
            },
            ],
            as: "favourite_count",
          },
        },
        {
          $lookup: {
            from: "followunfollows",
            let: {
              property_id: "$_id"
            },
            pipeline: [{
              $match: {
                $expr: {
                  $and: [{
                    $eq: ["$property_id", "$$property_id"]
                  },
                  {
                    $eq: ["$follow_unfollow", true]
                  },
                  ],
                },
              },
            },
            {
              $count: "followerCount",
            },
            ],
            as: "followers_count",
          },
        },
        {
          $project: {
            _id: 1,
            id: "$_id",
            email: 1,
            location: 1,
            newlocation: 1,
            distance: 1,
            address: 1,
            state: 1,
            country: 1,
            zipcode: 1,
            categories: 1,
            categoriesDetails: "$categoriesDetails",
            amenitiesDetails: 1,
            type: 1,
            city: 1,
            price: 1,
            propertyType: 1,
            likedUsers: {
              $map: {
                input: "$likedUsers",
                as: "user",
                in: {
                  id: "$$user._id",
                  name: "$$user.fullName",
                },
              },
            },
            followUsers: {
              $map: {
                input: "$followUsers",
                as: "user",
                in: {
                  id: "$$user._id",
                  name: "$$user.fullName",
                },
              },
            },
            createdAt: 1,
            updatedAt: 1,
            images: 1,
            content: 1,
            status: 1,
            isDeleted: 1,
            agency: 1,
            surface: 1,
            propertyFloor: 1,
            toilets: 1,
            livingRoom: 1,
            rooms: 1,
            bedrooms: 1,
            totalFloorBuilding: 1,
            situation: 1,
            building: 1,
            usedAs: 1,
            // state: 1,
            propertyState: 1,
            equipment: 1,
            outside: 1,
            serviceAccessibility: 1,
            ancilliary: 1,
            environment: 1,
            leisure: 1,
            investment: 1,
            agencyDetails: "$agencyDetails",
            cooking: 1,
            heatingType: 1,
            energymode: 1,
            dateOfDiagnosis: 1,
            diagnosisType: 1,
            energyConsumption: 1,
            emissions: 1,
            energy_efficient: 1,
            emission_efficient: 1,
            diagnosisDate: 1,
            contact: 1,
            transparency: 1,
            username: 1,
            phoneNumber: 1,
            propertyCharges: 1,
            propertyAgencyFees: 1,
            propertyTitle: 1,
            sale_my_property: 1,
            real_estate_market: 1,
            userLeads: 1,
            rateLeads: 1,
            maxLeads: 1,
            exactLocation: 1,
            randomLocation: 1,
            chooseDocumentGrade: 1,
            chooseDocumentMinProbability: 1,
            isChoosedDocumentVerified: 1,
            isChoosedDeclDocumentVerified: 1,
            maximumLead: 1,
            importBy: 1,
            request_status: "$request_status",
            addedBy: "$addedBy",
            amenities: "$amenitiesDetails._id",
            cooking_id: "$cooking",
            favourite_details: {
              $ifNull: ["$favourite_details.like", false]
            },
            revenue_detail: "$revenue_detail",
            renovation_work: "$renovation_work",
            rating: "$rating",
            Expenses: "$Expenses",
            addedBy_details: "$addedBy_details",
            accountType: "$addedBy_details.accountType",
            add_more_step: "$add_more_step",
            propertyMonthlyCharges: "$propertyMonthlyCharges",
            favourite_details: {
              $ifNull: ["$favourite_details.like", false]
            },
            new_messages: {
              $size: "$new_messages"
            },
            searchType: "$searchType",
            guaranteeDeposit: "$guaranteeDeposit",
            propertyInventory: "$propertyInventory",
            proposal: "$proposal",
            totalLeads: 1,
            // interestDetails: 1,
            handleBy: "$handleBy",
            offMarket: 1,
            agencyType: "$agencyType",
            followunfollows_details: {
              $ifNull: ["$followunfollows_details.follow_unfollow", false],
            },
            likeCount: {
              $ifNull: [{
                $arrayElemAt: ["$favourite_count.likeCount", 0]
              }, 0],
            },
            followerCount: {
              $ifNull: [{
                $arrayElemAt: ["$followers_count.followerCount", 0]
              },
                0,
              ],
            },
            linkedSchools: 1,
            propertyViewerCount: 1,
          },
        },
      ];

      if (schoolStatus || schoolName) {
        pipeline.push({
          $lookup: {
            from: "schools",
            localField: "linkedSchools.schoolId",
            foreignField: "_id",
            as: "linkedSchoolsDetails"
          }
        });

        pipeline.push({
          $unwind: {
            path: "$linkedSchoolsDetails",
            preserveNullAndEmptyArrays: false
          }
        });

        const matchStage = {};
        if (schoolStatus) {
          matchStage["linkedSchoolsDetails.status"] = schoolStatus;
        }
        if (schoolName) {
          matchStage["linkedSchoolsDetails.EstablishmentName"] = {
            $regex: schoolName,
            $options: "i"
          };
        }

        pipeline.push({ $match: matchStage });
      }


      let group_stage = {
        $group: {
          _id: "$_id",
          email: {
            $first: "$email"
          },
          location: {
            $first: "$location"
          },
          newlocation: {
            $first: "$newlocation"
          },
          address: {
            $first: "$address"
          },
          state: {
            $first: "$state"
          },
          country: {
            $first: "$country"
          },
          zipcode: {
            $first: "$zipcode"
          },
          categories: {
            $first: "$categories"
          },
          categoriesDetails: {
            $first: "$categoriesDetails"
          },
          type: {
            $first: "$type"
          },
          city: {
            $first: "$city"
          },
          price: {
            $first: "$price"
          },
          propertyType: {
            $first: "$propertyType"
          },
          likedUsers: {
            $first: "$likedUsers"
          },
          followUsers: {
            $first: "$followUsers"
          },
          createdAt: {
            $first: "$createdAt"
          },
          updatedAt: {
            $first: "$updatedAt"
          },
          images: {
            $first: "$images"
          },
          content: {
            $first: "$content"
          },
          status: {
            $first: "$status"
          },
          isDeleted: {
            $first: "$isDeleted"
          },
          agency: {
            $first: "$agency"
          },
          surface: {
            $first: "$surface"
          },
          propertyFloor: {
            $first: "$propertyFloor"
          },
          toilets: {
            $first: "$toilets"
          },
          livingRoom: {
            $first: "$livingRoom"
          },
          rooms: {
            $first: "$rooms"
          },
          bedrooms: {
            $first: "$bedrooms"
          },
          exactLocation: {
            $first: "$exactLocation"
          },
          randomLocation: {
            $first: "$randomLocation"
          },
          totalFloorBuilding: {
            $first: "$totalFloorBuilding"
          },
          situation: {
            $first: "$situation"
          },
          building: {
            $first: "$building"
          },
          equipment: {
            $first: "$equipment"
          },
          outside: {
            $first: "$outside"
          },
          serviceAccessibility: {
            $first: "$serviceAccessibility"
          },
          ancilliary: {
            $first: "$ancilliary"
          },
          environment: {
            $first: "$environment"
          },
          leisure: {
            $first: "$leisure"
          },
          investment: {
            $first: "$investment"
          },
          agencyDetails: {
            $first: "$agencyDetails"
          },
          cooking: {
            $first: "$cooking"
          },
          heatingType: {
            $first: "$heatingType"
          },
          userLeads: {
            $first: "$userLeads"
          },
          rateLeads: {
            $first: "$rateLeads"
          },
          maxLeads: {
            $first: "$maxLeads"
          },
          energymode: {
            $first: "$energymode"
          },
          new_messages: {
            $first: "$new_messages"
          },
          dateOfDiagnosis: {
            $first: "$dateOfDiagnosis"
          },
          diagnosisType: {
            $first: "$diagnosisType"
          },
          energyConsumption: {
            $first: "$energyConsumption"
          },
          emissions: {
            $first: "$emissions"
          },
          energy_efficient: {
            $first: "$energy_efficient"
          },
          emission_efficient: {
            $first: "$emission_efficient"
          },
          diagnosisDate: {
            $first: "$diagnosisDate"
          },
          contact: {
            $first: "$contact"
          },
          transparency: {
            $first: "$transparency"
          },
          username: {
            $first: "$username"
          },
          phoneNumber: {
            $first: "$phoneNumber"
          },
          usedAs: {
            $first: "$usedAs"
          },
          propertyCharges: {
            $first: "$propertyCharges"
          },
          propertyAgencyFees: {
            $first: "$propertyAgencyFees"
          },
          propertyTitle: {
            $first: "$propertyTitle"
          },
          sale_my_property: {
            $first: "$sale_my_property"
          },
          real_estate_market: {
            $first: "$real_estate_market"
          },
          addedBy: {
            $first: "$addedBy"
          },
          propertyState: {
            $first: "$propertyState"
          },
          amenitiesDetails: {
            $first: "$amenitiesDetails"
          },
          favourite_details: {
            $first: "$favourite_details"
          },
          addedBy_details: {
            $first: "$addedBy_details"
          },
          accountType: {
            $first: "$accountType"
          },
          add_more_step: {
            $first: "$add_more_step"
          },
          likeCount: {
            $first: "$likeCount"
          },
          followerCount: {
            $first: "$followerCount"
          },
          rating: {
            $first: "$rating"
          },
          revenue_detail: {
            $first: "$revenue_detail"
          },
          renovation_work: {
            $first: "$renovation_work"
          },
          Expenses: {
            $first: "$Expenses"
          },
          propertyMonthlyCharges: {
            $first: "$propertyMonthlyCharges"
          },
          request_status: {
            $first: "$request_status"
          },
          cooking: {
            $first: "$cooking"
          },
          equipment: {
            $first: "$equipment"
          },
          serviceAccessibility: {
            $first: "$serviceAccessibility"
          },
          outside: {
            $first: "$outside"
          },
          environment: {
            $first: "$environment"
          },
          leisure: {
            $first: "$leisure"
          },
          ancilliary: {
            $first: "$ancilliary"
          },
          followunfollows_details: {
            $first: "$followunfollows_details"
          },
          searchType: {
            $first: "$searchType"
          },
          proposal: {
            $first: "$proposal"
          },
          guaranteeDeposit: {
            $first: "$guaranteeDeposit"
          },
          propertyInventory: {
            $first: "$propertyInventory"
          },
          totalLeads: {
            $first: "$totalLeads"
          },
          linkedSchools: {
            $first: "$linkedSchools"
          },
          // linkedSchoolsDetails: {
          //   $push: "$linkedSchoolsDetails"
          // },
          offMarket: {
            $first: "$offMarket"
          },
          chooseDocumentGrade: {
            $first: "$chooseDocumentGrade"
          },
          chooseDocumentMinProbability: {
            $first: "$chooseDocumentMinProbability"
          },
          isChoosedDocumentVerified: {
            $first: "$isChoosedDocumentVerified"
          },
          isChoosedDeclDocumentVerified: {
            $first: "$isChoosedDeclDocumentVerified"
          },
          maximumLead: {
            $first: "$maximumLead"
          },
          importBy: {
            $first: "$importBy"
          }
        },
      };
      let sorting = {
        $sort: sortquery,
      };
      // Fast-path: if no heavy filters are present, use a lightweight find() with projection
      const heavyFiltersPresent = Boolean(
        amenities || address || situation || investment || loggedInUser || schoolId || schoolType || schoolStatus || schoolName || add_more_step
      );

      if (!dynamicRentFiltering && !heavyFiltersPresent) {
        // Lightweight query: only return essential fields for the listing table
        const projection = {          propertyTitle: 1,
          address: 1,
          city: 1,
          zipcode: 1,
          price: 1,
          loyer: 1,
          propertyMonthlyCharges: 1,
          status: 1,
          images: { $slice: 1 },
          createdAt: 1,
          addedBy: 1,
          propertyType: 1,
          proposal: 1,
          location: 1,
          newlocation: 1,
          exactLocation: 1,
          randomLocation: 1,
          offMarket: 1,
          propertyViewerCount: 1,
        };

        // Use pre-computed counter when no complex filters are active (O(1) vs O(N) countDocuments)
        // Falls back to countDocuments when a filter narrows the result set beyond total counts.
        let total;
        const queryKeys = Object.keys(query || {});
        const financingKeys = Object.keys(financingProbabilityMatch || {});
        const extraFilters = [...new Set([...queryKeys, ...financingKeys])];
        const isSimpleActiveQuery = queryKeys.length === 2
          && queryKeys.includes('isDeleted')
          && queryKeys.includes('status')
          && query.status === 'active'
          && query.isDeleted === false
          && financingKeys.length === 0;

        // City + propertyType in listing: { isDeleted, status, $text, propertyType }
        const isCityAndType = queryKeys.length === 4
          && query.isDeleted === false
          && query.status === 'active'
          && query.$text
          && query.propertyType
          && financingKeys.length === 0;

        if (isSimpleActiveQuery) {
          const cached = await statsService.getTotal();
          total = (cached !== null) ? cached : await Property.countDocuments({ ...query });
        } else if (isCityAndType) {
          const search = req.query.search || '';
          const textCity = search.split(/[ ,]/)[0]?.trim()?.toLowerCase() || '';
          const cached = textCity ? await statsService.getCount(`city:${textCity}|type:${query.propertyType}`) : null;
          total = (cached !== null) ? cached : await Property.countDocuments({ ...query, ...financingProbabilityMatch });
        } else if (query.$text && pageNumber > 1) {
          // Text search on pages 2+: reuse cachedTotal sent by client
          const clientTotal = Number(req.query.cachedTotal);
          total = (clientTotal > 0) ? clientTotal : await Property.countDocuments({ ...query, ...financingProbabilityMatch });
        } else {
          total = await Property.countDocuments({ ...query, ...financingProbabilityMatch });
        }

        // Cursor-based pagination (avoids slow skip() for deep pages)
        // When cursor is provided, use _id < cursor instead of skip(N)
        const useCursor = !!cursor && !query.$text; // cursor + $text don't mix (relevance sort varies)
        let cursorFilter = {};
        if (useCursor) {
          try {
            cursorFilter = { _id: { $lt: new mongoose.Types.ObjectId(cursor) } };
          } catch (_) { /* invalid cursor, fall back to skip */ }
        }
        const paginatedQuery = { ...query, ...financingProbabilityMatch, ...cursorFilter };

        // For text search without explicit sort, use empty sort (avoids slow in-memory sort of 7000+ docs)
        const fastPathSort = (query.$text && !sortBy) ? {} : sortquery;
        const limit = Number(pageSize);
        let cursorSort = fastPathSort;
        if (useCursor) {
          // For cursor pagination, always include _id:-1 as the final sort key
          cursorSort = { ...fastPathSort, _id: -1 };
        }

        const docs = await Property.find(paginatedQuery)
          .select(projection)
          .sort(cursorSort)
          .skip(useCursor ? 0 : Math.max(0, (pageNumber - 1) * pageSize))
          .limit(limit + (useCursor ? 1 : 0)) // fetch 1 extra when using cursor to detect next page
          .populate('addedBy', 'firstName lastName fullName image accountType companyLogo featuredProfilePhoto username companyName')
          .lean();

        // Extract next cursor — only when there IS a next page
        let nextCursor = null;
        let resultDocs = docs;
        if (useCursor && docs.length > limit) {
          resultDocs = docs.slice(0, limit);
          nextCursor = docs[limit - 1]._id;
        } else {
          resultDocs = docs;
        }

        // Normalise: expose populated user as addedBy_details
        const docsWithOwner = resultDocs.map(d => {
          // Transform newlocation.coordinates → location.lat/lng if not already present
          if (d.newlocation?.coordinates && !d.location?.lat) {
            d.location = {
              ...(d.location || {}),
              lat: d.newlocation.coordinates[1],
              lng: d.newlocation.coordinates[0],
            };
          }
          return {
            ...d,
            addedBy_details: d.addedBy && typeof d.addedBy === 'object' ? d.addedBy : {},
            addedBy: d.addedBy?._id || d.addedBy,
          };
        });

        // Fast-path: no logged-in user → tag all off-market as blurred_no_account
        const processedDocs = docsWithOwner.map(d => {
          const isOm = d.offMarket === true || String(d.propertyType || '').toLowerCase() === 'offmarket';
          if (!isOm) return d;
          return { offMarket: true, offMarketAccessLevel: 'blurred_no_account', propertyType: d.propertyType };
        });

        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.RETRIEVED,
          total,
          data: processedDocs,
          ...(useCursor ? { nextCursor } : {}),
        });
      }

      pipeline.push(group_stage);
      pipeline.push(sorting);

      const canUseCountDocuments = !schoolStatus && !schoolName;
      let total = 0;
      if (!dynamicRentFiltering) {
        if (canUseCountDocuments) {
          total = await Property.countDocuments({
            ...query,
            ...financingProbabilityMatch,
            ...(schoolTypeArray.length ? { "linkedSchools.type": { $in: schoolTypeArray } } : {}),
            ...(schoolIdArray.length ? { "linkedSchools.schoolId": { $in: schoolIdArray } } : {}),
          });
        } else {
          // Minimal count pipeline for school-detail filters (does not include $skip/$limit)
          const countMatchStage = {};
          if (schoolStatus) countMatchStage["linkedSchoolsDetails.status"] = schoolStatus;
          if (schoolName) countMatchStage["linkedSchoolsDetails.EstablishmentName"] = { $regex: schoolName, $options: "i" };
          const totalResult = await db.property.aggregate([
            {
              $match: {
                ...query,
                ...financingProbabilityMatch,
                ...(schoolTypeArray.length ? { "linkedSchools.type": { $in: schoolTypeArray } } : {}),
                ...(schoolIdArray.length ? { "linkedSchools.schoolId": { $in: schoolIdArray } } : {}),
              }
            },
            { $lookup: { from: "schools", localField: "linkedSchools.schoolId", foreignField: "_id", as: "linkedSchoolsDetails" } },
            { $unwind: { path: "$linkedSchoolsDetails", preserveNullAndEmptyArrays: false } },
            { $match: countMatchStage },
            { $count: "count" },
          ]);
          total = totalResult.length ? totalResult[0].count : 0;
        }
      }

      let result;
      if (dynamicRentFiltering) {
        const allResults = await Property.aggregate([...pipeline]);
        const filteredResults = (await Promise.all(
          allResults.map(async (property) => {
            if (String(property.propertyType).toLowerCase() !== "rent") {
              return property;
            }

            const renterScoreResult = await scoreService.computeRenterScore({
              declarativeRenterFiles: loggedInUserDeclarativeRenterFiles,
              property,
            });
            const rentScore = Number(renterScoreResult?.score ?? 0);
            const threshold = Number(property.chooseDocumentMinProbability ?? 0);
            return rentScore >= threshold ? property : null;
          })
        )).filter(Boolean);

        total = filteredResults.length;
        result = filteredResults.slice(skipNo, skipNo + pageSize);
      } else {
        // Normalize newlocation.coordinates → location.lat/lng for frontend map
        // Only adds lat/lng if newlocation exists and location.lat is not already set
        pipeline.push({
          $addFields: {
            location: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$newlocation", null] },
                    { $eq: [{ $ifNull: ["$location.lat", null] }, null] },
                  ],
                },
                then: {
                  lat: { $arrayElemAt: ["$newlocation.coordinates", 1] },
                  lng: { $arrayElemAt: ["$newlocation.coordinates", 0] },
                },
                else: "$location",
              },
            },
          },
        });
        if (!earlyPaginate) {
          pipeline.push({
            $skip: Number(skipNo),
          }, {
            $limit: Number(pageSize),
          });
        }
        result = await Property.aggregate([...pipeline]);
      }
      // ─── Off-Market access level post-processing ────────────────────────
      // accessible     → full data, card shown normally
      // blurred_*      → minimal placeholder, card blurred
      // hidden         → removed from results, total adjusted
      // A property is considered off-market if either the boolean flag offMarket===true
      // OR propertyType==="offmarket" is set (both must be access-controlled).
      const isOffMarketProp = (p) => p.offMarket === true || String(p.propertyType || '').toLowerCase() === 'offmarket';
      if (result && result.some(p => isOffMarketProp(p))) {
        const processed = [];
        let hiddenCount = 0;
        for (const property of result) {
          if (!isOffMarketProp(property)) { processed.push(property); continue; }
          const accessLevel = await getOffMarketAccessLevel(property, loggedInUser, loggedInUserData);
          if (accessLevel === 'hidden') {
            hiddenCount++;
          } else if (accessLevel === 'accessible') {
            processed.push({ ...property, offMarketAccessLevel: 'accessible' });
          } else {
            // Blurred: return only minimal data – no ID, no address, no price
            processed.push({ offMarket: true, offMarketAccessLevel: accessLevel, propertyType: property.propertyType });
          }
        }
        result = processed;
        if (hiddenCount > 0) total = Math.max(0, total - hiddenCount);
      }

      return res.status(200).json({
        success: true,
        message: constants.PROPERTY.RETRIEVED,
        total,
        data: result,
      });
    } catch (error) {
      console.log(error);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error.message,
        },
      });
    }
  },

  // listing: async (req, res) => {
  //   try {
  //     let {
  //       search,
  //       rooms,
  //       page,
  //       count ,
  //       sortBy,
  //       status,
  //       minSurface,
  //       maxSurface,
  //       categories,
  //       agencyId,
  //       type,
  //       propertyType,
  //       addedBy,
  //       userId,
  //       amenities,
  //       minPrice,
  //       maxPrice,
  //       energy_efficient,
  //       propertyFloor,
  //       bedrooms,
  //       favourites,
  //       cooking,
  //       equipment,
  //       serviceAccessibility,
  //       outside,
  //       add_more_step,
  //       environment,
  //       leisure,
  //       ancilliary,
  //       investment,
  //       situation,
  //       userLng,
  //       userLat,
  //       maxDistance,
  //       request_status,
  //       proposal,
  //       nameSearch,
  //       schoolId,
  //       schoolType,
  //       schoolStatus,
  //       offMarket,
  //       loggedInUser,
  //       accountType,
  //     } = req.query;

  //     // Initialize query object
  //     let query = {
  //       isDeleted: false
  //     };

  //     // Build query for search (address, state, country, city)
  //     if (search) {
  //       const searchTerms = search.split(" / ").map((term) => term.trim());
  //       query.$or = searchTerms.flatMap((fullAddress) => [{
  //         address: {
  //           $regex: fullAddress,
  //           $options: "i"
  //         }
  //       },
  //       {
  //         state: {
  //           $regex: fullAddress,
  //           $options: "i"
  //         }
  //       },
  //       {
  //         country: {
  //           $regex: fullAddress,
  //           $options: "i"
  //         }
  //       },
  //       {
  //         city: {
  //           $regex: fullAddress,
  //           $options: "i"
  //         }
  //       },
  //       ]);
  //     }

  //     if (nameSearch) {
  //       query.propertyTitle = {
  //         $regex: nameSearch,
  //         $options: "i"
  //       };
  //     }

  //     if (agencyId) {
  //       query.agency = new mongoose.Types.ObjectId(agencyId);
  //     }

  //     if (type) {
  //       const types = type.split(",").map((t) => new RegExp(t.trim(), "i"));
  //       query.type = {
  //         $in: types
  //       };
  //     }

  //     if (rooms) {
  //       query.rooms = {
  //         $in: rooms.split(",").map(String)
  //       };
  //     }

  //     if (bedrooms) {
  //       query.bedrooms = {
  //         $in: bedrooms.split(",").map(String)
  //       };
  //     }

  //     if (energy_efficient) {
  //       query.energy_efficient = energy_efficient;
  //     }

  //     if (minSurface || maxSurface) {
  //       query.$expr = {
  //         $and: [
  //           minSurface ? {
  //             $gte: [{
  //               $toDouble: "$surface"
  //             }, Number(minSurface)]
  //           } : {},
  //           maxSurface ? {
  //             $lte: [{
  //               $toDouble: "$surface"
  //             }, Number(maxSurface)]
  //           } : {},
  //         ].filter(Boolean),
  //       };
  //     }

  //     if (minPrice || maxPrice) {
  //       query.price = {};
  //       if (!isNaN(minPrice)) query.price.$gte = Number(minPrice);
  //       if (!isNaN(maxPrice)) query.price.$lte = Number(maxPrice);
  //     }

  //     if (status) {
  //       query.status = status;
  //     }

  //     if (request_status) {
  //       query.request_status = request_status;
  //     }

  //     if (categories) {
  //       query.categories = new mongoose.Types.ObjectId(categories);
  //     }
  //     if (accountType) {
  //       query.accountType = accountType;
  //     }
  //     if (propertyType) {
  //       query.propertyType = propertyType;
  //     }

  //     if (addedBy) {
  //       query.addedBy = new mongoose.Types.ObjectId(addedBy);
  //     }

  //     if (amenities) {
  //       query.amenities = {
  //         $in: amenities.split(",").map((id) => new mongoose.Types.ObjectId(id.trim())),
  //       };
  //     }

  //     if (cooking) {
  //       query.cooking = {
  //         $in: cooking.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (equipment) {
  //       query.equipment = {
  //         $in: equipment.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (serviceAccessibility) {
  //       query.serviceAccessibility = {
  //         $in: serviceAccessibility.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (outside) {
  //       query.outside = {
  //         $in: outside.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (environment) {
  //       query.environment = {
  //         $in: environment.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (leisure) {
  //       query.leisure = {
  //         $in: leisure.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (ancilliary) {
  //       query.ancilliary = {
  //         $in: ancilliary.split(",").map((id) => id.trim())
  //       };
  //     }

  //     if (investment) {
  //       const investments = investment.split(",").map((i) => new RegExp(i.trim(), "i"));
  //       query.investment = {
  //         $in: investments
  //       };
  //     }

  //     if (situation) {
  //       const situations = situation.split(",").map((s) => new RegExp(s.trim(), "i"));
  //       query.situation = {
  //         $in: situations
  //       };
  //     }

  //     if (propertyFloor) {
  //       query.propertyFloor = {
  //         $in: propertyFloor.split(",").map(String)
  //       };
  //     }

  //     if (proposal) {
  //       query.proposal = proposal;
  //     }


  //     if (favourites) {
  //       query.favourite_details = favourites === "true";
  //     }

  //     if (add_more_step) {
  //       query.add_more_stage = add_more_step === "true";
  //     }

  //     if (offMarket != null) {
  //       query.offMarket = offMarket === "true";
  //     }
  //     // Handle logged-in user document verification and grade
  //     let documentVerificationMatch = {};
  //     let documentGradeMatch = {};
  //     if (loggedInUser) {
  //       const loggedInUserData = await db.users.findOne({
  //         _id: loggedInUser
  //       });
  //       const userGrade = loggedInUserData?.documentGrade || "Any";
  //       console.log("USERGRADE:", userGrade);
  //       // const allowedGradesMap = {
  //       //   Any: ["A", "B", "C", "D", "E", "Any"],
  //       //   A: ["A", "B", "C", "D", "E", "Any"],
  //       //   B: ["B", "C", "D", "E", "Any"],
  //       //   C: ["C", "D", "E", "Any"],
  //       //   D: ["D", "E", "Any"],
  //       //   E: ["E", "Any"],
  //       // };

  //       const allowedGradesMap = {
  //         Any: ["A", "B", "C", "D", "E",],
  //         A: ["A"],
  //         B: ["A", "B"],
  //         C: ["A", "B", "C"],
  //         D: ["A", "B", "C", "D"],
  //         E: ["A", "B", "C", "D", "E"],
  //       };
  //       const userDocumentVerified = loggedInUserData?.isDocumentVerified;
  //       const userDeclDocumentVerified = loggedInUserData?.isDeclDocumentVerified;
  //       // console.log("isDocumentVerified:", userDocumentVerified);
  //       // console.log("isDeclDocumentVerified:", userDeclDocumentVerified);

  //       documentGradeMatch = userGrade && allowedGradesMap[userGrade] ?
  //         {
  //           chooseDocumentGrade: {
  //             $in: allowedGradesMap[userGrade]
  //           }
  //         } :
  //         {};

  //       // documentVerificationMatch = {
  //       //   ...(userDocumentVerified ? {} : {
  //       //     isChoosedDocumentVerified: {
  //       //       $ne: true
  //       //     }
  //       //   }),
  //       //   ...(userDeclDocumentVerified ? {} : {
  //       //     isChoosedDeclDocumentVerified: {
  //       //       $ne: true
  //       //     }
  //       //   }),
  //       // };

  //       if (userDocumentVerified && userDeclDocumentVerified) {
  //         documentVerificationMatch = {
  //           $or: [
  //             { isChoosedDocumentVerified: true },
  //             { isChoosedDeclDocumentVerified: true }
  //           ]
  //         };
  //       } else if (userDocumentVerified) {
  //         documentVerificationMatch = {
  //           isChoosedDocumentVerified: true
  //         };
  //       } else if (userDeclDocumentVerified) {
  //         documentVerificationMatch = {
  //           isChoosedDeclDocumentVerified: true
  //         };
  //       } else {
  //         documentVerificationMatch = {
  //           isChoosedDocumentVerified: false,
  //           isChoosedDeclDocumentVerified: false
  //         };
  //       }
  //     }

  //     // Initialize sort query
  //     let sortquery = {
  //       createdAt: -1
  //     };
  //     if (sortBy) {
  //       const [field, sortType] = sortBy.split(" ");
  //       sortquery[field || "createdAt"] = sortType === "desc" ? -1 : 1;
  //     }

  //     // Build aggregation pipeline
  //     const pipeline = [
  //       // Lookup for interests
  //       {
  //         $lookup: {
  //           from: "interests",
  //           localField: "_id",
  //           foreignField: "propertyId",
  //           as: "interestDetails",
  //         },
  //       },
  //       {
  //         $addFields: {
  //           totalLeads: {
  //             $size: "$interestDetails"
  //           },
  //         },
  //       },
  //       // Lookup for amenities
  //       {
  //         $lookup: {
  //           from: "amenities",
  //           localField: "amenities",
  //           foreignField: "_id",
  //           as: "amenitiesDetails",
  //         },
  //       },
  //       // Lookup for categories
  //       {
  //         $lookup: {
  //           from: "categories",
  //           localField: "categories",
  //           foreignField: "_id",
  //           as: "categoriesDetails",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$categoriesDetails",
  //           preserveNullAndEmptyArrays: true
  //         },
  //       },
  //       // Lookup for agency
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "agency",
  //           foreignField: "_id",
  //           as: "agencyDetails",
  //         },
  //       },
  //       // Lookup for liked users
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "like",
  //           foreignField: "_id",
  //           as: "likedUsers",
  //         },
  //       },
  //       // Lookup for followed users
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "follow",
  //           foreignField: "_id",
  //           as: "followUsers",
  //         },
  //       },
  //       // Lookup for addedBy
  //       {
  //         $lookup: {
  //           from: "users",
  //           localField: "addedBy",
  //           foreignField: "_id",
  //           as: "addedBy_details",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$addedBy_details",
  //           preserveNullAndEmptyArrays: true
  //         },
  //       },
  //       // Lookup for favorites
  //       {
  //         $lookup: {
  //           from: "favorites",
  //           let: {
  //             property_id: "$_id",
  //             user_id: userId ? new mongoose.Types.ObjectId(userId) : null
  //           },
  //           pipeline: [{
  //             $match: {
  //               $expr: {
  //                 $and: [{
  //                   $eq: ["$property_id", "$$property_id"]
  //                 },
  //                 userId ? {
  //                   $eq: ["$user_id", "$$user_id"]
  //                 } : {},
  //                 ].filter(Boolean),
  //               },
  //             },
  //           },],
  //           as: "favourite_details",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$favourite_details",
  //           preserveNullAndEmptyArrays: true
  //         },
  //       },
  //       // Lookup for follow/unfollow
  //       {
  //         $lookup: {
  //           from: "followunfollows",
  //           let: {
  //             property_id: "$_id",
  //             user_id: userId ? new mongoose.Types.ObjectId(userId) : null
  //           },
  //           pipeline: [{
  //             $match: {
  //               $expr: {
  //                 $and: [{
  //                   $eq: ["$property_id", "$$property_id"]
  //                 },
  //                 userId ? {
  //                   $eq: ["$user_id", "$$user_id"]
  //                 } : {},
  //                 ].filter(Boolean),
  //               },
  //             },
  //           },],
  //           as: "followunfollows_details",
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: "$followunfollows_details",
  //           preserveNullAndEmptyArrays: true
  //         },
  //       },
  //       // Lookup for unread messages
  //       {
  //         $lookup: {
  //           from: "messages",
  //           let: {
  //             property_id: "$_id",
  //             status: "unread"
  //           },
  //           pipeline: [{
  //             $match: {
  //               $expr: {
  //                 $and: [{
  //                   $eq: ["$property_id", "$$property_id"]
  //                 },
  //                 {
  //                   $eq: ["$status", "$$status"]
  //                 },
  //                 ],
  //               },
  //             },
  //           },],
  //           as: "new_messages",
  //         },
  //       },
  //       // Lookup for like count
  //       {
  //         $lookup: {
  //           from: "favorites",
  //           let: {
  //             property_id: "$_id"
  //           },
  //           pipeline: [{
  //             $match: {
  //               $expr: {
  //                 $and: [{
  //                   $eq: ["$property_id", "$$property_id"]
  //                 },
  //                 {
  //                   $eq: ["$like", true]
  //                 },
  //                 ],
  //               },
  //             },
  //           },
  //           {
  //             $count: "likeCount"
  //           },
  //           ],
  //           as: "favourite_count",
  //         },
  //       },
  //       // Lookup for follower count
  //       {
  //         $lookup: {
  //           from: "followunfollows",
  //           let: {
  //             property_id: "$_id"
  //           },
  //           pipeline: [{
  //             $match: {
  //               $expr: {
  //                 $and: [{
  //                   $eq: ["$property_id", "$$property_id"]
  //                 },
  //                 {
  //                   $eq: ["$follow_unfollow", true]
  //                 },
  //                 ],
  //               },
  //             },
  //           },
  //           {
  //             $count: "followerCount"
  //           },
  //           ],
  //           as: "followers_count",
  //         },
  //       },
  //       // Project fields
  //       {
  //         $project: {
  //           _id: 1,
  //           id: "$_id",
  //           email: 1,
  //           location: 1,
  //           distance: 1,
  //           address: 1,
  //           state: 1,
  //           country: 1,
  //           zipcode: 1,
  //           categories: 1,
  //           categoriesDetails: 1,
  //           amenitiesDetails: 1,
  //           type: 1,
  //           city: 1,
  //           price: 1,
  //           propertyType: 1,
  //           likedUsers: {
  //             $map: {
  //               input: "$likedUsers",
  //               as: "user",
  //               in: {
  //                 id: "$$user._id",
  //                 name: "$$user.fullName"
  //               },
  //             },
  //           },
  //           followUsers: {
  //             $map: {
  //               input: "$followUsers",
  //               as: "user",
  //               in: {
  //                 id: "$$user._id",
  //                 name: "$$user.fullName"
  //               },
  //             },
  //           },
  //           createdAt: 1,
  //           updatedAt: 1,
  //           images: 1,
  //           content: 1,
  //           status: 1,
  //           isDeleted: 1,
  //           agency: 1,
  //           surface: 1,
  //           propertyFloor: 1,
  //           toilets: 1,
  //           livingRoom: 1,
  //           rooms: 1,
  //           bedrooms: 1,
  //           totalFloorBuilding: 1,
  //           situation: 1,
  //           building: 1,
  //           usedAs: 1,
  //           propertyState: 1,
  //           equipment: 1,
  //           outside: 1,
  //           serviceAccessibility: 1,
  //           ancilliary: 1,
  //           environment: 1,
  //           leisure: 1,
  //           investment: 1,
  //           agencyDetails: 1,
  //           cooking: 1,
  //           heatingType: 1,
  //           energymode: 1,
  //           dateOfDiagnosis: 1,
  //           diagnosisType: 1,
  //           energyConsumption: 1,
  //           emissions: 1,
  //           energy_efficient: 1,
  //           emission_efficient: 1,
  //           diagnosisDate: 1,
  //           contact: 1,
  //           transparency: 1,
  //           username: 1,
  //           phoneNumber: 1,
  //           propertyCharges: 1,
  //           propertyAgencyFees: 1,
  //           propertyTitle: 1,
  //           sale_my_property: 1,
  //           real_estate_market: 1,
  //           userLeads: 1,
  //           rateLeads: 1,
  //           maxLeads: 1,
  //           exactLocation: 1,
  //           randomLocation: 1,
  //           chooseDocumentGrade: 1,
  //           isChoosedDocumentVerified: 1,
  //           isChoosedDeclDocumentVerified: 1,
  //           maximumLead: 1,
  //           request_status: 1,
  //           addedBy: 1,
  //           shareCount: 1,
  //           amenities: "$amenitiesDetails._id",
  //           cooking_id: "$cooking",
  //           favourite_details: {
  //             $ifNull: ["$favourite_details.like", false]
  //           },
  //           revenue_detail: 1,
  //           renovation_work: 1,
  //           rating: 1,
  //           Expenses: 1,
  //           addedBy_details: 1,
  //           accountType: "$addedBy_details.accountType",
  //           add_more_step: 1,
  //           propertyMonthlyCharges: 1,
  //           new_messages: {
  //             $size: "$new_messages"
  //           },
  //           searchType: 1,
  //           guaranteeDeposit: 1,
  //           propertyInventory: 1,
  //           proposal: 1,
  //           totalLeads: 1,
  //           handleBy: 1,
  //           offMarket: 1,
  //           agencyType: 1,
  //           propertyViewerCount: 1,
  //           followunfollows_details: {
  //             $ifNull: ["$followunfollows_details.follow_unfollow", false]
  //           },
  //           likeCount: {
  //             $ifNull: [{
  //               $arrayElemAt: ["$favourite_count.likeCount", 0]
  //             }, 0]
  //           },
  //           followerCount: {
  //             $ifNull: [{
  //               $arrayElemAt: ["$followers_count.followerCount", 0]
  //             }, 0]
  //           },
  //           linkedSchools: 1,
  //           linkedSchoolsDetails: 1,
  //         },
  //       },
  //       // Apply main query filters
  //       {
  //         $match: {
  //           ...query,
  //           ...documentGradeMatch,
  //           ...documentVerificationMatch,
  //         },
  //       },
  //       // Filter by schoolType
  //       ...(schoolType ?
  //         [{
  //           $match: {
  //             "linkedSchools.type": {
  //               $in: schoolType.split(",").map((type) => type.trim()),
  //             },
  //           },
  //         },] :
  //         []),
  //       // Filter by schoolId
  //       ...(schoolId ?
  //         [{
  //           $match: {
  //             "linkedSchools.schoolId": {
  //               $in: schoolId
  //                 .split(",")
  //                 .map((id) => new mongoose.Types.ObjectId(id.trim())),
  //             },
  //           },
  //         },] :
  //         []),
  //       // Filter by schoolStatus with lookup
  //       ...(schoolStatus ?
  //         [{
  //           $lookup: {
  //             from: "schools",
  //             let: {
  //               schoolIds: "$linkedSchools.schoolId"
  //             },
  //             pipeline: [{
  //               $match: {
  //                 $expr: {
  //                   $and: [{
  //                     $in: ["$_id", "$$schoolIds"]
  //                   },
  //                   {
  //                     $eq: ["$schoolStatus", schoolStatus]
  //                   },
  //                   ],
  //                 },
  //               },
  //             },],
  //             as: "linkedSchoolsDetails",
  //           },
  //         },
  //         {
  //           $addFields: {
  //             linkedSchools: {
  //               $filter: {
  //                 input: "$linkedSchools",
  //                 as: "school",
  //                 cond: {
  //                   $in: ["$$school.schoolId", "$linkedSchoolsDetails._id"]
  //                 },
  //               },
  //             },
  //           },
  //         },
  //         {
  //           $match: {
  //             "linkedSchools.0": {
  //               $exists: true
  //             },
  //           },
  //         },
  //         ] :
  //         []),
  //       // Sorting
  //       {
  //         $sort: sortquery
  //       },
  //       // Pagination
  //       ...(page && count ?
  //         [{
  //           $skip: (Number(page) - 1) * Number(count)
  //         },
  //         {
  //           $limit: Number(count)
  //         },
  //         ] :
  //         []),
  //     ];

  //     // Calculate total count for pagination
  //     const totalPipeline = [...pipeline];
  //     if (page && count) {
  //       totalPipeline.pop(); // Remove $limit
  //       totalPipeline.pop(); // Remove $skip
  //     }
  //     const total = await db.property.aggregate(totalPipeline);

  //     // Execute the main pipeline
  //     const result = await db.property.aggregate(pipeline);

  //     return res.status(200).json({
  //       success: true,
  //       data: result,
  //       total: total,
  //       message: constants.PROPERTY.RETRIEVED,
  //     });
  //   } catch (error) {
  //     console.error("Error in property listing:", error);
  //     return res.status(400).json({
  //       success: false,
  //       error: {
  //         code: 400,
  //         message: error.message,
  //       },
  //     });
  //   }
  // },

  statusChange: async (req, res) => {
    try {
      let id = req.body.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.ID_MISSING,
        });
      } else {
        let findProperty = await Property.findOne({
          _id: id
        });
        if (findProperty) {
          if (findProperty.status == "active") {
            await Property.updateOne({
              _id: id
            }, {
              status: "deactive"
            });
            statsService.decrement(findProperty);
            coordService.remove(findProperty._id);
          } else {
            await Property.updateOne({
              _id: id
            }, {
              status: "active"
            });
            statsService.increment(findProperty);
            coordService.upsert(findProperty);
          }
          return res.status(200).json({
            success: true,
            message: constants.PROPERTY.STATUS_CHANGED,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: constants.PROPERTY.NOT_FOUND,
          });
        }
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error.message,
        },
      });
    }
  },

  delete: async (req, res) => {
    try {
      let id = req.query.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.ID_MISSING,
        });
      }
      let findProperty = await Property.findOne({
        _id: id,
        isDeleted: false
      });
      if (findProperty) {
        await Property.updateOne({
          _id: id
        }, {
          isDeleted: true
        });

        // Decrement stats if property was active
        if (findProperty.status === 'active') {
          statsService.decrement(findProperty);
          coordService.remove(findProperty._id);
        }

        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.DELETED,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.NOT_FOUND,
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error.message,
        },
      });
    }
  },

  // editProperty: async (req, res) => {
  //   try {
  //     let data = req.body;
  //     const propertyId = data.id;
  //     if (!propertyId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: constants.PROPERTY.ID_MISSING,
  //       });
  //     }
  //     let property = await Property.findOne({ _id: propertyId });
  //     if (!property) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Property not found."
  //       })
  //     }
  //     // Step 1: Identify updated types
  //     const newLinkedSchools = Array.isArray(data.linkedSchools) ? data.linkedSchools : [];
  //     const newTypes = newLinkedSchools.map(s => s.type);
  //     const existingTypes = property.linkedSchools.map(s => s.type);

  //     // Step 2: Remove types that are missing in the update payload
  //     const typesToRemove = existingTypes.filter(t => !newTypes.includes(t));

  //     for (const type of typesToRemove) {
  //       const index = property.linkedSchools.findIndex(s => s.type === type);
  //       if (index !== -1) {
  //         const schoolId = property.linkedSchools[index].schoolId;

  //         // Unlink property from the old school
  //         await db.schools.updateOne(
  //           { _id: schoolId },
  //           { $pull: { linkedProperties: { propertyId } } }
  //         );

  //         // Remove school reference from property
  //         property.linkedSchools.splice(index, 1);
  //       }
  //     }

  //     // Step 3: Update (or insert) new types
  //     for (const incoming of newLinkedSchools) {
  //       const { schoolId, type, EstablishmentName } = incoming;

  //       const existingIndex = property.linkedSchools.findIndex(s => s.type === type);
  //       if (existingIndex !== -1) {
  //         const oldSchoolId = property.linkedSchools[existingIndex].schoolId;

  //         if (String(oldSchoolId) !== String(schoolId)) {
  //           // Replace old school
  //           await db.schools.updateOne(
  //             { _id: oldSchoolId },
  //             { $pull: { linkedProperties: { propertyId } } }
  //           );

  //           property.linkedSchools.splice(existingIndex, 1);
  //           property.linkedSchools.push({ schoolId, type, EstablishmentName });

  //           await db.schools.updateOne(
  //             { _id: schoolId },
  //             { $addToSet: { linkedProperties: { propertyId } } }
  //           );
  //         }
  //       } else {
  //         // Add new type/school
  //         property.linkedSchools.push({ schoolId, type, EstablishmentName });

  //         await db.schools.updateOne(
  //           { _id: schoolId },
  //           { $addToSet: { linkedProperties: { propertyId } } }
  //         );
  //       }
  //     }

  //     const updateFields = { ...data };
  //     delete updateFields.id;
  //     delete updateFields.linkedSchools;
  //     delete updateFields._id;

  //     Object.assign(property, updateFields);
  //     await property.save();
  //     // const updated = await Property.updateOne({ _id: data.id }, data);
  //     return res.status(200).json({
  //       success: true,
  //       data: property,
  //       message: constants.PROPERTY.UPDATED,
  //     });
  //   } catch (error) {
  //     console.log("Error is:", error)
  //     return res.status(400).json({
  //       success: false,
  //       error: {
  //         code: 400,
  //         message: error.message,
  //       },
  //     });
  //   }
  // },


  editProperty: async (req, res) => {
    console.log('@editProperty');
    
    try {
      let data = req.body;
      const propertyId = data.id;
      if (!propertyId) {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.ID_MISSING,
        });
      }

      let property = await Property.findOne({
        _id: propertyId
      });
      if (!property) {
        return res.status(400).json({
          success: false,
          message: "Property not found.",
        });
      }

      if(data.addedBy && String(data.addedBy) != String(property.addedBy) ) {

        const user = req.identity
        
        if(user.role == "admin"){
          // check peer compaings
          let checkPeerCampaigns = await db.peerCampaign.find({ propertyId: propertyId, status: 'active' });          
            if(checkPeerCampaigns.length > 0) {
              const latestEndDate = checkPeerCampaigns.reduce((max, campaign) => {
              return new Date(campaign.endDate) > new Date(max)
                ? campaign.endDate
                : max;
              }, checkPeerCampaigns[0].endDate);

          // format date
          const campaignEndDate = new Date(latestEndDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          return res.status(400).json({
            success: false,
            message: `Cannot change the owner while a campaign is active. You can make changes after ${campaignEndDate}.`,
          });
        }
      }
    }

      // Step 1: Identify updated types for linkedSchools
      const newLinkedSchools = Array.isArray(data.linkedSchools) ? data.linkedSchools : [];
      const newTypes = newLinkedSchools.map(s => s.type);
      const existingTypes = property.linkedSchools.map(s => s.type);

      // Step 2: Remove types that are missing in the update payload
      const typesToRemove = existingTypes.filter(t => !newTypes.includes(t));

      for (const type of typesToRemove) {
        const index = property.linkedSchools.findIndex(s => s.type === type);
        if (index !== -1) {
          const schoolId = property.linkedSchools[index].schoolId;

          // Unlink property from the old school
          await db.schools.updateOne({
            _id: schoolId
          }, {
            $pull: {
              linkedProperties: {
                propertyId
              }
            }
          });

          // Remove school reference from property
          property.linkedSchools.splice(index, 1);
        }
      }

      // Step 3: Update (or insert) new types for linkedSchools
      for (const incoming of newLinkedSchools) {
        const {
          schoolId,
          type,
          EstablishmentName
        } = incoming;

        const existingIndex = property.linkedSchools.findIndex(s => s.type === type);
        if (existingIndex !== -1) {
          const oldSchoolId = property.linkedSchools[existingIndex].schoolId;

          if (String(oldSchoolId) !== String(schoolId)) {
            // Replace old school
            await db.schools.updateOne({
              _id: oldSchoolId
            }, {
              $pull: {
                linkedProperties: {
                  propertyId
                }
              }
            });

            property.linkedSchools.splice(existingIndex, 1);
            property.linkedSchools.push({
              schoolId,
              type,
              EstablishmentName
            });

            await db.schools.updateOne({
              _id: schoolId
            }, {
              $addToSet: {
                linkedProperties: {
                  propertyId
                }
              }
            });
          }
        } else {
          // Add new type/school
          property.linkedSchools.push({
            schoolId,
            type,
            EstablishmentName
          });

          await db.schools.updateOne({
            _id: schoolId
          }, {
            $addToSet: {
              linkedProperties: {
                propertyId
              }
            }
          });
        }
      }

      // Step 4: Prepare update fields
      const updateFields = {
        ...data
      };
      delete updateFields.id;
      delete updateFields.linkedSchools;
      delete updateFields._id;
      const arrayFields = ['leisure', 'environment', 'ancilliary', 'serviceAccessibility', 'outside', 'equipment'];
      for (const field of arrayFields) {
        if (updateFields[field]) {
          try {
            updateFields[field] = processArrayField(updateFields[field]);
          } catch (err) {
            return res.status(400).json({
              success: false,
              message: `${field.charAt(0).toUpperCase() + field.slice(1)} field error: ${err.message}`,
            });
          }
        }
      }

      // Set identityVerified based on sellerFiles presence
      if (updateFields.hasOwnProperty('sellerFiles')) {
        const hasSellerFiles = updateFields.sellerFiles && Object.keys(updateFields.sellerFiles).length > 0;
        updateFields.identityVerified = hasSellerFiles;
      }

      // ── Timeline : détecter les nouveaux éléments ajoutés ──────────────
      const userId = req.identity.id;
      const now = new Date();

      // Dépenses
      if (Array.isArray(updateFields.Expenses) && updateFields.Expenses.length > (property.Expenses || []).length) {
        const newExpenses = updateFields.Expenses.slice((property.Expenses || []).length);
        for (const exp of newExpenses) {
          await db.timeline.create({
            propertyId, addedBy: userId, type: 'expenseAdded', createdAt: now, updatedAt: now,
            meta: {
              amount: exp.price || null,
              label: exp.label || null,
            },
          });
        }
      }

      // Travaux de rénovation
      if (Array.isArray(updateFields.renovation_work) && updateFields.renovation_work.length > (property.renovation_work || []).length) {
        const newWorks = updateFields.renovation_work.slice((property.renovation_work || []).length);
        for (const work of newWorks) {
          await db.timeline.create({
            propertyId, addedBy: userId, type: 'renovationAdded', createdAt: now, updatedAt: now,
            meta: {
              amount: work.price || null,
              title: work.title || null,
              imagesCount: (work.images || []).length,
            },
          });
        }
      }

      // Évaluations externes
      if (Array.isArray(updateFields.rating) && updateFields.rating.length > (property.rating || []).length) {
        const newRatings = updateFields.rating.slice((property.rating || []).length);
        for (const rtg of newRatings) {
          await db.timeline.create({
            propertyId, addedBy: userId, type: 'externalRating', createdAt: now, updatedAt: now,
            meta: {
              value: rtg.rating_value || null,
              platform: rtg.type || null,
            },
          });
        }
      }

      const updated = await Property.updateOne({
        _id: propertyId
      }, {
        $set: {
          ...updateFields,
          linkedSchools: property.linkedSchools
        }
      }, {
        runValidators: true
      });

      if (updated.matchedCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Failed to update property.",
        });
      }
      const updatedProperty = await Property.findOne({ _id: propertyId });

      // Update stats if city, zipcode, propertyType, or status changed
      const oldProp = property;
      const newProp = updatedProperty;
      const statsChanged = (
        (oldProp.city || '').toLowerCase() !== (newProp.city || '').toLowerCase() ||
        (oldProp.zipcode || '') !== (newProp.zipcode || '') ||
        (oldProp.propertyType || '') !== (newProp.propertyType || '') ||
        (oldProp.status || '') !== (newProp.status || '')
      );
      if (statsChanged) {
        if (oldProp.status === 'active') {
          statsService.decrement(oldProp);
          coordService.remove(oldProp._id);
        }
        if (newProp.status === 'active') {
          statsService.increment(newProp);
          coordService.upsert(newProp);
        }
      } else if (newProp.status === 'active') {
        // Stats didn't change but coordinates might (e.g. price update)
        coordService.upsert(newProp);
      }

      logActivity(req.identity.id, "property_update", { label: "Bien modifié", objectType: "property", objectId: propertyId, objectTitle: updatedProperty.propertyTitle || "" });
      return res.status(200).json({
        success: true,
        data: updatedProperty,
        message: constants.PROPERTY.UPDATED,
      });
    } catch (error) {
      console.log("Error in editProperty:", error);
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error,
        },
      });
    }
  },

  featureUnfeatureProperty: async (req, res) => {
    try {
      let id = req.body.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.ID_MISSING,
        });
      }
      let findProperty = await Property.findOne({
        _id: id
      });
      if (findProperty) {
        if (findProperty.featured == false) {
          await Property.updateOne({
            _id: id
          }, {
            featured: true
          });
          return res.status(200).json({
            success: true,
            message: constants.PROPERTY.FEATURED,
          });
        } else {
          await Property.updateOne({
            _id: id
          }, {
            featured: false
          });
          return res.status(200).json({
            success: true,
            message: constants.PROPERTY.UNFEATURED,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: constants.PROPERTY.NOT_FOUND,
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: error.message,
        },
      });
    }
  },

  exportProperty: async (req, res) => {
    try {
      let {
        agency
      } = req.query;
      let query = {};
      if (agency) {
        const agencyObjectId = parseObjectId(agency);
        if (agencyObjectId) {
          query.agency = agencyObjectId;
        }
      }
      query.isDeleted = false;
      const pipeline = [{
        $match: query
      },
      {
        $lookup: {
          from: "amenities",
          localField: "amenities",
          foreignField: "_id",
          as: "amenitiesDetails",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categories",
          foreignField: "_id",
          as: "categoriesDetails",
        },
      },
      {
        $unwind: {
          path: "$categoriesDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          id: "$_id",
          name: 1,
          location: 1,
          address: 1,
          state: 1,
          country: 1,
          zipcode: 1,
          categories: 1,
          categoriesDetails: "$categoriesDetails",
          amenitiesDetails: 1,
          type: 1,
          city: 1,
          price: 1,
          propertyType: 1,
          likedUsers: {
            $map: {
              input: "$likedUsers",
              as: "user",
              in: {
                id: "$$user._id",
                name: "$$user.fullName",
              },
            },
          },
          followUsers: {
            $map: {
              input: "$followUsers",
              as: "user",
              in: {
                id: "$$user._id",
                name: "$$user.fullName",
              },
            },
          },
          createdAt: 1,
          updatedAt: 1,
          images: 1,
          content: 1,
          status: 1,
          isDeleted: 1,
          agency: 1,
          surface: 1,
          propertyFloor: 1,
          toilets: 1,
          livingRoom: 1,
          rooms: 1,
          totalFloorBuilding: 1,
          situation: 1,
          building: 1,
          state: 1,
          equipment: 1,
          outside: 1,
          serviceAccessibility: 1,
          ancilliary: 1,
          environment: 1,
          leisure: 1,
          investment: 1,
          agencyDetails: "$agencyDetails",
          cooking: 1,
          heatingType: 1,
          energymode: 1,
          dateOfDiagnosis: 1,
          diagnosisType: 1,
          energyConsumption: 1,
          emissions: 1,
          energy_efficient: 1,
          emission_efficient: 1,
          diagnosisDate: 1,
          contact: 1,
          transparency: 1,
          username: 1,
          phoneNumber: 1,
          propertyCharges: 1,
          propertyAgencyFees: 1,
          propertyTitle: 1,
          sale_my_property: 1,
          real_estate_market: 1,
          addedBy: "$addedBy",
        },
      },
      ];

      const result = await Property.aggregate([...pipeline]);

      const csvStringifier = createObjectCsvStringifier({
        header: [{
          id: "name",
          title: "name"
        },
        {
          id: "diagnosisType",
          title: "diagnosisType"
        },
        {
          id: "type",
          title: "type"
        },
        {
          id: "amenities",
          title: "amenities"
        },
        {
          id: "categories",
          title: "categories"
        },
        {
          id: "cooking",
          title: "cooking"
        },
        {
          id: "status",
          title: "status"
        },
        {
          id: "propertyCharges",
          title: "propertyCharges"
        },
        {
          id: "propertyAgencyFees",
          title: "propertyAgencyFees"
        },
        {
          id: "propertyType",
          title: "propertyType"
        },
        ],
      });

      const csvData = result.map((item) => {
        return {
          name: item.name,
          diagnosisType: item.diagnosisType,
          type: item.diagnosisType,
          amenities: item.amenities ?
            item.amenities.map((amenity) => amenity.title).join(", ") : "",
          categories: item.categories && item.categories.name ? item.categories : null,
          cooking: Array.isArray(item.cooking) ?
            item.cooking.map((cookings) => cookings.title).join(", ") : "",
          status: item.status,
          propertyCharges: item.propertyCharges,
          propertyAgencyFees: item.propertyAgencyFees,
          propertyType: item.propertyType,
        };
      });
      const readable = new Readable({
        read() {
          this.push(csvStringifier.getHeaderString());
          this.push(csvStringifier.stringifyRecords(csvData));
          this.push(null);
        },
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=property.csv");
      readable.pipe(res);
    } catch (err) {
      console.log(err, "========================");
      return res.status(400).json({
        success: false,
        error: {
          code: 400,
          message: "" + err,
        },
      });
    }
  },

  importProperty: async (req, res) => {
    let duplicate = 0;
    let createdCount = 0;
    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: "File size must be less than 10 MB",
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "File upload error",
          },
        });
      } else if (err) {
        return res.status(500).json({
          success: false,
          error: {
            code: 500,
            message: "Unknown server error",
          },
        });
      }

      const uploadedFile = req.file;

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "No file uploaded",
          },
        });
      }

      if (
        uploadedFile.mimetype !==
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" &&
        uploadedFile.mimetype !== "text/csv"
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: "Invalid file type",
          },
        });
      }

      const filename = uploadedFile.originalname;
      const filepath = uploadedFile.path;

      try {
        let users_arr;

        if (filename.endsWith(".csv")) {
          const fileStream = fs.createReadStream(filepath, "utf8");
          users_arr = await parseCSV(fileStream);
        } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
          const workbook = xlsx.readFile(filepath);
          const sheetName = workbook.SheetNames[0];
          users_arr = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else {
          return res.status(400).json({
            success: false,
            error: {
              code: 400,
              message: "Unsupported file format",
            },
          });
        }

        if (users_arr && users_arr.length > 0) {
          let totalUser = users_arr.length;
          let alreadyExist = 0;
          let newusers = 0;
          const allowedTypes = ["apartment", "castle", "farm", "building", "house"];
          const allowedPropertyTypes = ["sale", "rent", "directory"];
          const allowedSituations = ["Souplex", "Ground floor", "single-storey", "Duplex"];

          for (let user of users_arr) {
            console.log({
              user
            });
            try {

              if (!user.type ||
                !user.propertyType ||
                !req.identity?.id ||
                !user.zipcode ||
                !user.address
              ) {
                console.log(`Skipping property: missing required fields for property ${user.name}`);
                continue;
              }

              if (!allowedTypes.includes(user.type)) {
                console.log(`Skipping property: invalid type "${user.type}" for user ${user.name}`);
                continue;
              }

              if (!allowedPropertyTypes.includes(user.propertyType)) {
                console.log(`Skipping property: invalid propertyType "${user.propertyType}" for user ${user.name}`);
                continue;
              }

              if (!allowedSituations.includes(user.situation)) {
                console.log(`Skipping situation: invalid situation "${user.situation}" for user ${user.name}`);
                continue;
              }

              const [category, propertyState] = await Promise.all([
                db.categories.findOne({
                  name: user.categories,
                  isDeleted: false
                }).select("_id"),
                db.revenue.findOne({
                  name: user.propertyState,
                  isDeleted: false
                }).select("_id"),
              ]);

              const amenityKeysArray = [
                "equipment",
                "outside",
                "ancilliary",
                "serviceAccessibility",
                "environment",
                "leisure",
                "investment",
                "cooking",
              ];

              const amenityKeysSingle = ["energymode", "heatingType"];
              const amenityPromises = [...amenityKeysArray, ...amenityKeysSingle].map(key =>
                db.amenities.findOne({
                  title: user[key], isDeleted: false
                }).select("_id"));
              const amenityResults = await Promise.all(amenityPromises);

              const amenityIds = {};
              [...amenityKeysArray, ...amenityKeysSingle].forEach((key, idx) => {
                const id = amenityResults[idx]?._id || null;
                if (amenityKeysArray.includes(key)) {
                  amenityIds[key] = id ? [id] : [];
                } else {
                  amenityIds[key] = id;
                }
              });


              const lng = parseFloat(user.lng);
              const lat = parseFloat(user.lat);

              const location = { lng, lat };
              const newlocation = {
                type: "Point",
                coordinates: [lng, lat],
              };


              const propertyData = {
                name: user.name,
                propertyTitle: user.propertyTitle || user.name,
                addedBy: req.identity.id,
                importBy: "platform",
                location,
                newlocation,
                images: user.images,
                propertyType: user.propertyType,
                content: user.content,
                address: user.address,
                zipcode: user.zipcode,
                country: user.country,
                state: user.state,
                city: user.city,
                price: Number(user.price) || 0,
                type: user.type,
                featured: !!user.featured,
                status: "active",
                // ? STATUS.ACTIVE
                // : STATUS.INACTIVE,
                bedrooms: user.bedrooms,
                rooms: user.rooms,
                bathroom: user.bathroom,
                surface: user.surface,
                propertyFloor: user.propertyFloor,
                toilets: user.toilets,
                livingRoom: user.livingRoom,
                totalFloorBuilding: user.totalFloorBuilding,
                propertyMonthlyCharges: Number(user.propertyMonthlyCharges) || 0,
                guaranteeDeposit: Number(user.guaranteeDeposit) || 0,
                propertyInventory: Number(user.propertyInventory) || 0,
                situation: [user.situation],
                building: user.building,
                propertyState: propertyState?._id || null,
                category: category?._id || null,
                ...amenityIds,
                offMarket: false,
                chooseDocumentGrade: "Any",
                isChoosedDeclDocumentVerified: false,
                isChoosedDocumentVerified: false,
                maximumLead: null,
                dateOfDiagnosis: user.dateOfDiagnosis,
                diagnosisType: user.diagnosisType,
                energyConsumption: user.energyConsumption,
                energy_efficient: user.energy_efficient,
                emissions: user.emissions,
                contact: false,
                transparency: false,
                username: user.username,
                phoneNumber: user.phoneNumber,
                propertyCharges: Number(user.propertyCharges) || 0,
                usedAs: user.usedAs,
                propertyAgencyFees: Number(user.propertyAgencyFees) || 0,
                sale_my_property: false,
                real_estate_market: false,
                add_more_step: false,
                request_status: "pending",
                exactLocation: true,
              };


              let createdUser = await Property.create(propertyData);

              createdCount++;
            } catch (err) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 400,
                  message: err.message,
                },
              });
            }
          }
          let message;
          if (alreadyExist == totalUser) {
            return res.status(400).json({
              success: false,
              code: 400,
              message: "This file property has been already exist",
            });
          } else if (alreadyExist == 0) {
            message = "Property imported successfully";
          } else {
            message = `${newusers} record successfully imported out of ${totalUser} because excel sheet having ${totalUser - newusers
              } duplicate/already exist in system records.`;
          }
          return res.status(200).json({
            success: true,
            message: message,
          });
        }

        res.status(200).json({
          success: true,
          message: `Property imported successfully`,
        });
      } catch (err) {
        console.log(err);
        res.status(500).json({
          success: false,
          error: {
            code: 500,
            message: err.message,
          },
        });
      } finally {
        fs.unlink(filepath, (err) => {
          if (err) {
            console.error("Error removing uploaded file:", err);
          }
        });
      }
    });
  },

  likeUnlikeProperty: async (req, res) => {
    try {
      const {
        propertyId,
        userId
      } = req.body;

      if (!propertyId || !userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "400",
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }

      const property = await Property.findOne({
        _id: propertyId
      });
      if (!property) {
        return res.status(404).json({
          success: false,
          error: {
            code: "404",
            message: constants.PROPERTY.NOT_FOUND,
          },
        });
      }

      const isLiked = property.like.includes(userId);
      if (isLiked) {
        property.like.pull(userId);
        await property.save();
        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.UN_LIKED,
        });
      } else {
        property.like.addToSet(userId);
        await property.save();
        logActivity(userId, "property_like", { label: "Bien ajouté aux favoris", objectType: "property", objectId: propertyId, objectTitle: property.propertyTitle || "" });
        logPropertyActivity(propertyId, "like", { userId, label: `Like par un utilisateur` });
        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.LIKED,
        });
      }
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: "500",
          message: err.message || "An unexpected error occurred",
        },
      });
    }
  },

  followProperty: async (req, res) => {
    try {
      const data = req.body;
      if (!data.propertyId || !data.userId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "400",
            message: constants.onBoarding.PAYLOAD_MISSING,
          },
        });
      }
      const property = await Property.findOne({
        _id: data.propertyId
      });
      if (!property) {
        return res.status(404).json({
          success: false,
          error: {
            code: "404",
            message: constants.PROPERTY.NOT_FOUND,
          },
        });
      }

      const isFollow = property.follow.includes(data.userId);
      if (isFollow) {
        property.follow.pull(data.userId);
        await property.save();
        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.UNFOLLOW,
        });
      } else {
        property.follow.addToSet(data.userId);
        await property.save();
        logActivity(data.userId, "property_follow", { label: "Bien suivi", objectType: "property", objectId: data.propertyId, objectTitle: property.propertyTitle || "" });
        logPropertyActivity(data.propertyId, "follow", { userId: data.userId, label: "Follow par un utilisateur" });
        return res.status(200).json({
          success: true,
          message: constants.PROPERTY.FOLLOW,
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

  getMyProperty: async (req, res) => {
    try {
      const {
        userId,
        propertyId,
        propertyType,
        interestUpdatedTime
      } = req.query;
      let page = parseInt(req.query.page) || 1;
      let count = parseInt(req.query.count) || 10;
      let query = {};
      const isGuestRequest =
        req.isGuest === true ||
        req.query.guest === "true" ||
        req.query.guest === "1" ||
        req.headers["x-guest-mode"] === "true" ||
        req.headers["x-guest-mode"] === "1" ||
        userId === "guest-user-000";

      if (isGuestRequest) {
        const guestProperties = buildGuestProperties(req);
        const filteredProperties = propertyType
          ? guestProperties.filter((property) => property.propertyType === propertyType)
          : guestProperties;
        const startIndex = (page - 1) * count;
        const pagedProperties = filteredProperties.slice(startIndex, startIndex + count);

        return res.status(200).json({
          success: true,
          message: "Guest properties loaded successfully.",
          Data: pagedProperties,
          total: filteredProperties.length,
          mockData: true,
          isMock: true,
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }
      const addedByUserId = parseObjectId(userId);
      if (!addedByUserId) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId"
        })
      }
      query.addedBy = addedByUserId;
      if (propertyType) {
        query.propertyType = propertyType;
      }
      query.isDeleted = false

      let sortCriteria;

      if (interestUpdatedTime && interestUpdatedTime === "true") {
        sortCriteria = {
          interestUpdatedTime: -1
        };
      } else {
        sortCriteria = {
          createdAt: -1
        };
      }

      const findProperties = await db.property.find(query)
        .select('id images propertyTitle address propertyType interestUpdatedTime visitSlots sellerFiles surface rooms bedrooms price propertyMonthlyCharges signingSlots homeInventorySlots autoInvite visitBookedCount contractSigned activityIndicatorCount')
        .sort(sortCriteria)
        .limit(count)
        .skip((page - 1) * count)
        .exec();
      if (!findProperties || findProperties.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No properties found.",
          Data: [],
          total: 0,

        })
      }

      const propertiesWithLeads = await Promise.all(
        findProperties.map(async (property) => {
          const findLeads = await db.interests.find({
            propertyId: property._id,
            isDeleted: false
          })
            .populate('buyerId', ' fullName firstName lastName image')
            .exec();
          const sellerFiles = property.sellerFiles || {};
          const sellerFilesCount = Object.keys(sellerFiles).reduce((count, key) => {
            const value = sellerFiles[key];
            if (Array.isArray(value) && value.length > 0) {
              count += 1;
            }
            return count;
          }, 0);
          return {
            ...property.toObject(),
            totalLeads: findLeads.length,
            userImages: findLeads.map((lead) => lead.buyerId?.image || "User must be deleted"),
            fulName: findLeads.map((name) => name.buyerId?.fullName || "Use must be deleted"),
            firstName: findLeads.map((name) => name.buyerId?.firstName || "Use must be deleted"),
            lastName: findLeads.map((name) => name.buyerId?.lastName || "Use must be deleted"),
            sellerFilesCount: sellerFilesCount,
          };
        })
      );

      // const property = await db.property.findOne({_id: propertyId, isDeleted: false})

      // const sellerFilesCount = property.sellerFiles ? Object.keys(user_data.sellerFiles).length : 0;


      const totalProperties = await db.property.countDocuments(query);
      return res.status(200).json({
        success: true,
        message: "Here is the list of your properties.",
        Data: propertiesWithLeads,
        total: totalProperties
      })
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Failed to get your properties.",
        error: err.message
      })
    }
  },

  shareProperty: async (req, res) => {
    console.log("api hit")
    try {
      const {
        propertyId,
        userId,
        email
      } = req.body;

      if (!propertyId && !email) {
        return res.status(400).json({
          success: false,
          message: "Please provide propertyId and Email."
        })
      }
      const findProperty = await db.property.findOne({
        isDeleted: false,
        _id: propertyId
      });

      if (!findProperty || findProperty.propertyType === "offmarket" || findProperty.offMarket === true) {
        return res.status(400).json({
          success: false,
          message: "Cannot share, either property does not exist or has type offmarket/directory."
        })
      }

      // if (userId != findProperty.addedBy) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "You can only share your own property."
      //   })
      // }

      const findSender = await db.users.findOne({
        isDeleted: false,
        _id: userId
      });
      let senderName = formatDisplayName(findSender);

      const findUserByEmail = await db.users.findOne({
        isDeleted: false,
        email: email
      });
      // console.log(findUserByEmail); 

      const existingCampaign = await db.peerCampaign.findOne({
        propertyId,
        status: "active"
      })

      const frontUrl = process.env.FRONT_WEB_URL || 'http://localhost:8089';
      console.log("DEBUG FRONT_WEB_URL:", process.env.FRONT_WEB_URL, "→ frontUrl:", frontUrl);
      const estimationUrl = `${frontUrl}/estimation?propertyId=${propertyId}`;
      const propertyTitle = findProperty.propertyTitle || "";
      const city = findProperty.city || "";
      const zipcode = findProperty.zipcode || "";
      const rooms = findProperty.rooms || "";
      const surface = findProperty.surface || "";
      const price = findProperty.price ? `${Number(findProperty.price).toLocaleString("fr-FR")} €` : "";
      const propType = findProperty.type
        ? { apartment: "Appartement", house: "Maison", castle: "Château", farm: "Ferme", building: "Immeuble" }[findProperty.type] || findProperty.type
        : "";
      const isRent = findProperty.propertyType === "rent";

      const buildEstimationEmail = (recipientExists) => {
        const ctaLabel = recipientExists ? "Donner mon estimation →" : "Créer mon compte et estimer →";
        return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Estimation immobilière - Bookaroo</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 20px">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <tr><td style="background:linear-gradient(135deg,#976DD0,#7b52b8);padding:28px 32px;text-align:center">
    <p style="color:#fff;margin:0 0 4px;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:0.85">Estimation participative</p>
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">🏠 Bookaroo</h1>
  </td></tr>
  <tr><td style="padding:32px 36px">
    <h2 style="color:#333;font-size:19px;margin:0 0 12px;font-weight:700">${senderName} vous invite à estimer un bien !</h2>
    <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px">
      Votre avis compte. Participez à l'estimation participative de ce bien immobilier et aidez à obtenir une évaluation juste du marché.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5fe;border-radius:10px;border-left:4px solid #976DD0;margin-bottom:28px">
      <tr><td style="padding:20px 24px">
        <p style="color:#976DD0;margin:0 0 14px;font-size:15px;font-weight:700">Caractéristiques du bien</p>
        <table width="100%" cellpadding="5" cellspacing="0">
          ${propertyTitle ? `<tr><td style="color:#888;font-size:13px;width:50%">🏷 Titre</td><td style="color:#333;font-weight:600;font-size:13px">${propertyTitle}</td></tr>` : ""}
          ${city ? `<tr><td style="color:#888;font-size:13px">📍 Localisation</td><td style="color:#333;font-weight:600;font-size:13px">${city}${zipcode ? ` (${zipcode})` : ""}</td></tr>` : ""}
          ${propType ? `<tr><td style="color:#888;font-size:13px">🏠 Type</td><td style="color:#333;font-weight:600;font-size:13px">${propType}</td></tr>` : ""}
          ${rooms ? `<tr><td style="color:#888;font-size:13px">🛏 Pièces</td><td style="color:#333;font-weight:600;font-size:13px">${rooms} pièce${rooms > 1 ? "s" : ""}</td></tr>` : ""}
          ${surface ? `<tr><td style="color:#888;font-size:13px">📐 Surface</td><td style="color:#333;font-weight:600;font-size:13px">${surface} m²</td></tr>` : ""}
          ${price ? `<tr><td style="color:#888;font-size:13px">${isRent ? "💰 Loyer" : "💰 Prix demandé"}</td><td style="color:#333;font-weight:600;font-size:13px">${price}${isRent ? "/mois" : ""}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>
    <div style="text-align:center">
      <a href="${estimationUrl}" style="display:inline-block;background:#976DD0;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:0.3px">${ctaLabel}</a>
    </div>
    <p style="color:#aaa;font-size:12px;text-align:center;margin:20px 0 0">
      Ou copiez ce lien dans votre navigateur :<br>
      <span style="color:#976DD0;word-break:break-all">${estimationUrl}</span>
    </p>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:16px 32px;text-align:center;border-top:1px solid #eee">
    <p style="color:#bbb;font-size:12px;margin:0">© Bookaroo — Plateforme d'estimation immobilière participative</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
      };

      if (!findUserByEmail) {

        if (existingCampaign) {
          await Promise.all([
            db.peerCampaign.updateOne(
              { _id: existingCampaign._id },
              { $inc: { shareCount: 1 } }),
            db.property.updateOne(
              { _id: propertyId },
              { $inc: { shareCount: 1 } })
          ]);
        } else {
          await db.property.updateOne(
            { _id: propertyId },
            { $inc: { shareCount: 1 } });
        }

        let nonExistingEmail = {
          name: senderName,
          email: email,
          propertyId: propertyId,
          userId: userId,
          signUpLink: `http://195.35.8.196:8089/Signup`,
          propertyLink: `http://195.35.8.196:8089/property-details?id=${propertyId}`,
        }
        await sendEmail({
          module: "AUTH",
          to: email,
          subject: `Donnez votre avis ! Estimation d'un bien${city ? ` à ${city}` : ""}`,
          htmlContent: buildEstimationEmail(false),
        });

        logPropertyActivity(propertyId, "share", { userId, label: "Partage du bien par un utilisateur" });
        return res.status(200).json({
          success: true,
          message: "Email sent to the User."
        })
      } else {

        if (existingCampaign) {
          await Promise.all([
            db.peerCampaign.updateOne(
              { _id: existingCampaign._id },
              { $inc: { shareCount: 1 } }),
            db.property.updateOne(
              { _id: propertyId },
              { $inc: { shareCount: 1 } })
          ]);
        } else {
          await db.property.updateOne(
            { _id: propertyId },
            { $inc: { shareCount: 1 } });
        }

        let existingEmail = {
          name: senderName,
          email: email,
          propertyId: propertyId,
          userId: userId,
          propertyLink: `http://195.35.8.196:8089/property-details?id=${propertyId}`
        }
        await sendEmail({
          module: "AUTH",
          to: email,
          subject: `Donnez votre avis ! Estimation d'un bien${city ? ` à ${city}` : ""}`,
          htmlContent: buildEstimationEmail(true),
        });

        logPropertyActivity(propertyId, "share", { userId, label: "Partage du bien par un utilisateur" });
        return res.status(200).json({
          success: true,
          message: "Email sent to the User"
        })
      }

    } catch (err) {
      console.log("SHARE PROP ERROR:", err);
      return res.status(400).json({
        success: false,
        message: "Failed to share the property.",
        error: err.message
      })
    }
  },

  claimYourProperty: async (req, res) => {
    try {
      const { name, email, mobileNo, claimMessage, userId, propertyId, docs } = req.body;

      if (!name || !email || !claimMessage || !userId || !propertyId || !docs) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }

      const existingClaim = await db.claimOwnerships.findOne({
        userId,
        propertyId,
        status: { $in: ["pending", "accept"] },
      });

      if (existingClaim) {
        return res.status(400).json({
          success: false,
          message:
            `You already have a claim for this property that is in ${existingClaim.status}.`,
        });
      }

      const newClaim = await db.claimOwnerships.create({
        name,
        email,
        claimMessage,
        mobileNo,
        userId,
        propertyId,
        docs,
        status: "pending",
      });

      return res.status(201).json({
        success: true,
        message: "Claim submitted successfully.",
        data: newClaim
      });

    } catch (error) {
      return handleServerError(res, error, "Claim Ownership")
    }
  },
  getAllClaimProperty: async (req, res) => {
    try {
      const {
        page = 1,
        count = 10,
        searchQuery,
        status,
      } = req.query;

      const filter = {};

      if (status && ["pending", "accept", "reject"].includes(status)) {
        filter.status = status;
      }

      if (searchQuery) {
        filter.$or = [
          { name: { $regex: searchQuery, $options: "i" } },
          { email: { $regex: searchQuery, $options: "i" } },
        ];
      }

      const skip = (Number(page) - 1) * Number(count);
      const limit = Number(count);

      const [claims, total] = await Promise.all([
        db.claimOwnerships.find(filter)
          .populate("userId", "fullName email")
          .populate("propertyId", "propertyTitle address")
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        db.claimOwnerships.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        message: "Claims fetched successfully",
        data: claims,
        total,
      });
    } catch (error) {
      return handleServerError(res, error, "List Claims");
    }

  },

  statusChangeClaimProperty: async (req, res) => {
    try {
      const { status, id, userId } = req.body;
      if (!status || !["pending", "accept", "reject"].includes(status) || !id) {
        return res.status(400).json({
          success: false,
          message: "Payload Missing"
        })
      }
      const findClaim = await db.claimOwnerships.findById(id);
      if (!findClaim) {
        return res.status(400).json({
          success: false,
          message: "Claim not found"
        })
      }

      if (status === "accept" && !userId) {
        return res.status(200).json({
          success: false,
          message: "userId required."
        })
      }

      if (findClaim.status === "accept") {
        return res.status(200).json({
          success: false,
          message: "Claim cannot be chnaged after accepting it."
        })
      }

      await db.claimOwnerships.updateOne({ _id: id }, { status })

      if (status === "accept") {

        await db.property.updateOne({
          _id: findClaim.propertyId
        }, {
          addedBy: userId,
          signingSlots: [],
          homeInventorySlots: [],
          visitBookedCount: 0,
          offerStatus: false,
        })
        return res.status(200).json({
          success: true,
          message: "Property claim accepted."
        })

      } else if (status === "reject") {
        return res.status(200).json({
          success: true,
          message: "Property claim rejected."
        })
      } else {
        return res.status(200).json({
          success: true,
          message: "Property claim in pending."
        })
      }

    } catch (error) {
      return handleServerError(res, error, "status change claim ownership");
    }
  },

  getClaimDetail: async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Id required"
        })
      }
      const findClaim = await db.claimOwnerships.findById(id)
        .populate("userId", "fullName email")
        .populate("propertyId", "propertyTitle address")
      return res.status(200).json({
        success: true,
        data: findClaim,
        message: "Claim data fetched"
      })
    } catch (error) {
      return handleServerError(res, error, "List Claims");
    }
  },

  getActivityStats: async (req, res) => {
    try {
      const propertyId = req.params.id;
      if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Valid property ID required"
        });
      }

      const objectId = new mongoose.Types.ObjectId(propertyId);

      // Get views (profile_view events)
      const viewsCount = await db.propertyActivityLog.countDocuments({
        propertyId: objectId,
        type: "profile_view"
      });

      // Get followers (follow_unfollow entries where follow_unfollow = true)
      const followersCount = await db.followUnfollow.countDocuments({
        property_id: objectId,
        follow_unfollow: true,
        isDeleted: false
      });

      // Get visit requests (visit_request events)
      const visitsCount = await db.propertyActivityLog.countDocuments({
        propertyId: objectId,
        type: "visit_request"
      });

      // Get interested people from the transaction pipeline
      // This matches the owner screen counter (totalLeads)
      const interestedCount = await db.interests.countDocuments({
        propertyId: objectId,
        isDeleted: false
      });

      return res.status(200).json({
        success: true,
        data: {
          views: viewsCount,
          followers: followersCount,
          interested: interestedCount,
          visits: visitsCount
        },
        message: "Activity stats retrieved successfully"
      });
    } catch (error) {
      return handleServerError(res, error, "Get Activity Stats");
    }
  }
}