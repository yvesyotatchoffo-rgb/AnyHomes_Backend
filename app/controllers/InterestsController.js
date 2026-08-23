const db = require("../models");
const mongoose = require("mongoose");
const Emails = require("../Emails/onBoarding");
const visitInvite = require("../Emails/visitInvite");
const scoreService = require("../services/financialScore.service");
const logActivity = require("../services/activityLog.service");
const logPropertyActivity = require("../services/propertyActivityLog.service");
const constants = require("../utls/constants");
const { sendEmail } = require("../config/brevo.config");
const fcm_service = require("../services/FcmServices");
const { formatDisplayName } = require('../utls/formatDisplayName');
const visitFolderCtrl = require("./VisitFolderController");

const buildGuestProspectImage = (req, filename) => {
  const origin = process.env.BACK_WEB_URL || "http://localhost:6089";
  return encodeURI(`${origin}/assets/img/Prospect img/${filename}`);
};

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

const normalizeScore = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.round(Math.max(0, Math.min(100, score)));
};

const getScoreClass = (score) => {
  const value = normalizeScore(score);
  if (value >= 85) return "TRES_FORTE";
  if (value >= 70) return "FORTE";
  if (value >= 55) return "INTERMEDIAIRE";
  if (value >= 40) return "FRAGILE";
  return "FAIBLE";
};

const getScoreLabel = (score) => {
  const value = normalizeScore(score);
  if (value >= 85) return "Très forte crédibilité";
  if (value >= 70) return "Forte crédibilité";
  if (value >= 55) return "Crédibilité intermédiaire";
  if (value >= 40) return "Crédibilité fragile";
  return "Crédibilité faible";
};

const getGuestTopReasons = (score, type = "sale") => {
  const value = normalizeScore(score);
  if (type === "rent") {
    if (value >= 85) {
      return [
        "Le loyer visé est très bien couvert par les revenus déclarés et le profil est bien structuré.",
      ];
    }
    if (value >= 70) {
      return [
        "La situation financière est cohérente et le dossier inspire confiance pour une location.",
      ];
    }
    if (value >= 55) {
      return [
        "Le dossier est acceptable mais certains éléments nécessitent une vérification plus poussée.",
      ];
    }
    if (value >= 40) {
      return [
        "Le dossier présente des fragilités qui peuvent rendre la candidature moins compétitive.",
      ];
    }
    return [
      "Le dossier est insuffisant pour une décision favorable sans justificatifs complémentaires.",
    ];
  }

  if (value >= 85) {
    return [
      "Les éléments financiers du dossier sont excellents et montrent un profil d’acquéreur très solide.",
    ];
  }
  if (value >= 70) {
    return [
      "Le dossier est solide et cohérent, avec une bonne capacité de financement.",
    ];
  }
  if (value >= 55) {
    return [
      "Le dossier est globalement correct mais pourrait gagner en solidité avec des pièces complémentaires.",
    ];
  }
  if (value >= 40) {
    return [
      "Le dossier montre des faiblesses qui doivent être corrigées pour convaincre le vendeur.",
    ];
  }
  return [
    "Le dossier reste insuffisant pour ce niveau de projet sans justificatifs supplémentaires.",
  ];
};

const computeFinancingProbability = (referenceScore, property) => {
  const score = normalizeScore(referenceScore);
  if (score === null) return 0;

  let finalScore = clamp(score, 0, 100);
  const price = property?.price || property?.propertyMonthlyCharges || 0;
  const referencePrice = property?.referencePrice || 0;

  if (referencePrice > 0 && price > 0) {
    const ratio = price / referencePrice;
    if (ratio > 1) {
      finalScore -= Math.round(Math.min(30, (ratio - 1) * 30));
    } else {
      finalScore += Math.round(Math.min(15, (1 - ratio) * 15));
    }
  }

  return clamp(finalScore, 0, 100);
};

const estimateScoreFromGrade = (grade) => {
  switch ((grade || "Any").toUpperCase()) {
    case "A":
      return 90;
    case "B":
      return 75;
    case "C":
      return 55;
    case "D":
      return 35;
    case "E":
      return 15;
    default:
      return 0;
  }
};

const hasBuyerSupportingDocuments = (buyer) => {
  const buyerFiles = buyer?.buyerFiles;
  if (!buyerFiles || typeof buyerFiles !== "object") return false;

  const containers = [
    "preAcceptance",
    "salarySlips",
    "bankStatement",
    "taxNotice",
    "personalContribution",
  ];

  return containers.some((container) =>
    Array.isArray(buyerFiles[container]) && buyerFiles[container].length > 0
  );
};

const buildGuestLeadUsers = (req) => {
  const images = [
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
    "sherise-van-dyk-X2OpvAPWSFE-unsplash.jpg",
    "abdullah-ali-1w9I6H4aftw-unsplash.jpg",
  ];

  const names = [
    "Nora Laurent",
    "Luc Martin",
    "Emma Leclerc",
    "Paul Dubois",
    "Chloe Moreau",
    "Hugo Bernard",
    "Lea Garnier",
    "Theo Petit",
    "Julie Rousseau",
    "Marc Faure",
    "Sophie Durand",
    "Julien Morel",
    "Camille Petit",
    "Antoine Girard",
    "Ines Lefevre",
    "Sebastien Roy",
    "Manon Lambert",
    "Alexandre Caron",
    "Claire Moulin",
    "Thomas Barbier",
    "Elise Fontaine",
  ];

  const cities = [
    "Paris",
    "Lyon",
    "Bordeaux",
    "Nice",
    "Toulouse",
    "Marseille",
    "Nantes",
    "Strasbourg",
    "Montpellier",
    "Lille",
    "Rouen",
    "Aix-en-Provence",
    "Dijon",
    "Nancy",
    "Rennes",
    "Grenoble",
    "Avignon",
    "Angers",
    "Metz",
    "Perpignan",
    "Poitiers",
  ];

    return images.map((filename, index) => {
        const id = `guest-user-${String(index + 1).padStart(3, "0")}`;
        // deterministic checks for mock data
        const isDocumentVerified = index % 3 === 0; // every 3rd user has document-verified
        const isDeclDocumentVerified = index % 4 === 0; // every 4th user has declarative-verified
        const documentGrade = isDocumentVerified ? (index % 5 === 0 ? "A" : "B") : "C";

        // simple deterministic scoring heuristic for mock financing probability
        let financingProbability = 35;
        financingProbability += isDocumentVerified ? 30 : 0;
        financingProbability += isDeclDocumentVerified ? 20 : 0;
        financingProbability += (index % 5) * 2; // small variance
        financingProbability = clamp(financingProbability, 5, 99);

        return {
            _id: id,
            fullName: names[index],
            image: buildGuestProspectImage(req, filename),
            city: cities[index],
            country: "France",
            // Financial check fields used by frontend to show background checks and score
            isDocumentVerified,
            isDeclDocumentVerified,
            documentGrade,
            financialChecks: {
                document: {
                    checked: isDocumentVerified,
                    grade: documentGrade,
                },
                declarative: {
                    checked: isDeclDocumentVerified,
                },
                financingProbability, // integer 0-100
            },
        };
    });
};

const buildGuestInterestCards = (req) => {
  const guestBuyers = buildGuestLeadUsers(req);
  const owner = { fullName: "Bookaroo Owner" };

  const saleProperty = {
    _id: "guest-prop-sale",
    propertyTitle: "Appartement 3 pièces - Paris 11e",
    city: "Paris",
    country: "France",
    zipcode: "75011",
    propertyType: "sale",
    surface: 120,
    rooms: 4,
    bathroom: 2,
    energy_efficient: "C",
    price: 890000,
    images: [{ file: "/assets/img/spacejoy-4xRP0Ajk9ys-unsplash.jpg" }],
    identityVerified: true,
    addedBy: owner,
  };

  const rentProperty = {
    _id: "guest-prop-rent",
    propertyTitle: "Studio 28 m² - Lille Centre",
    city: "Lille",
    country: "France",
    zipcode: "59000",
    propertyType: "rent",
    surface: 28,
    rooms: 1,
    bathroom: 1,
    energy_efficient: "C",
    propertyMonthlyCharges: 1450,
    images: [{ file: "/assets/img/spacejoy-85pCvDWDMmI-unsplash.jpg" }],
    identityVerified: true,
    addedBy: owner,
  };

  const saleFunnelSteps = [
    {
      funnelStatus: "interest received",
      title: "Interest received",
      image: "assets/img/dashboard/attractivity/attractivity-1.jpg",
      duration: "2:15",
    },
    {
      funnelStatus: "invite user for a visit",
      title: "Invite user for a visit",
      image: "assets/img/dashboard/attractivity/attractivity-2.jpg",
      duration: "3:00",
    },
    {
      funnelStatus: "visit accept by user",
      title: "Visit booked",
      image: "assets/img/dashboard/attractivity/attractivity-3.jpg",
      duration: "2:40",
      ownerVisitDate: new Date("2026-06-12T10:30:00Z"),
      finalVisitDate: { date: "2026-06-12", from: "10:30", to: "11:15" },
    },
    {
      funnelStatus: "visit hosted",
      title: "The visit took place on",
      image: "assets/img/dashboard/attractivity/attractivity-4.jpg",
      duration: "2:50",
      userVisitDate: new Date("2026-06-12T10:30:00Z"),
      finalVisitDate: { date: "2026-06-12", from: "10:30", to: "11:15" },
      review: { rating: 4.8, comment: "Très bonne visite, intéressant." },
    },
    {
      funnelStatus: "review submit by user",
      title: "Visit review received",
      image: "assets/img/dashboard/attractivity/attractivity-5.jpg",
      duration: "2:30",
      review: { rating: 4.8, comment: "Buyer review received." },
    },
    {
      funnelStatus: "buyer requested for document",
      title: "Document Request Received",
      image: "assets/img/dashboard/attractivity/attractivity-2.jpg",
      duration: "3:00",
      documents: {
        requested: true,
        requestedBy: "Bookaroo Owner",
        files: [{ name: "DPE.pdf", status: "requested" }],
      },
    },
    {
      funnelStatus: "document send by owner",
      title: "Document sent",
      image: "assets/img/dashboard/attractivity/attractivity-1.jpg",
      duration: "2:10",
      documents: {
        requested: true,
        sentBy: "Nora Laurent",
        files: [
          { name: "DPE.pdf", status: "sent" },
          { name: "Titre de propriété.pdf", status: "sent" },
        ],
      },
    },
    {
      funnelStatus: "offer submit by user",
      title: "Purchase offer received",
      image: "assets/img/dashboard/attractivity/attractivity-3.jpg",
      duration: "2:45",
      interestType: "offer sent",
      makeOfferAmount: 875000,
      makeOfferDescription: "Achat 875 000 € avec date d'emménagement 01/08/2026.",
      makeOfferMovinDate: "2026-08-01",
      makeOfferValidDate: "2026-07-01",
      buyerPrice: {
        amount: 875000,
        fundingType: ["Mortgage"],
        conditions: ["Subject to financing approval"],
      },
    },
    {
      funnelStatus: "offer submit by owner",
      title: "You sent a counter-offer",
      image: "assets/img/dashboard/attractivity/attractivity-4.jpg",
      duration: "2:20",
      interestType: "offer sent",
      makeOfferAmount: 895000,
      makeOfferDescription: "Contre-proposition 895 000 € - dossier à finaliser.",
      makeOfferMovinDate: "2026-08-15",
      makeOfferValidDate: "2026-07-05",
      buyerPrice: {
        amount: 895000,
        fundingType: ["Mortgage"],
        conditions: ["Dossier complet à finaliser"],
      },
    },
    {
      funnelStatus: "offer accept by owner",
      title: "Offer accepted",
      image: "assets/img/dashboard/attractivity/attractivity-5.jpg",
      duration: "2:55",
      interestType: "offer sent",
      makeOfferAmount: 895000,
      makeOfferDescription: "Offre acceptée par le vendeur.",
      makeOfferMovinDate: "2026-08-15",
      makeOfferValidDate: "2026-07-05",
      offerStatus: true,
      finalPrice: 895000,
      buyerPrice: {
        amount: 895000,
        fundingType: ["Mortgage"],
      },
    },
    {
      funnelStatus: "preslot opened by owner",
      title: "You opened pre-sale signing date",
      image: "assets/img/dashboard/attractivity/attractivity-2.jpg",
      duration: "3:05",
      finalSignSlot: { date: "2026-09-01", from: "11:00", to: "12:00" },
      ownerSigned: false,
    },
    {
      funnelStatus: "preslot accept by owner",
      title: "Pre-sale signing",
      image: "assets/img/dashboard/attractivity/attractivity-1.jpg",
      duration: "2:35",
      finalSignSlot: { date: "2026-09-01", from: "11:00", to: "12:00" },
      userSigned: true,
      ownerSigned: true,
    },
    {
      funnelStatus: "saleslot accept by user",
      title: "BuyerName booked a final sale signing date - ...",
      image: "assets/img/dashboard/attractivity/attractivity-3.jpg",
      duration: "2:45",
      finalSaleSlot: { date: "2026-09-20", from: "14:00", to: "15:00" },
      userSale: new Date("2026-09-20T14:00:00Z"),
    },
    {
      funnelStatus: "confirmation by user",
      title: "Final sale signing completed",
      image: "assets/img/dashboard/attractivity/attractivity-4.jpg",
      duration: "3:10",
      finalContract: new Date("2026-09-20T15:00:00Z"),
      ownerSigned: true,
      userSigned: true,
      applicationAccepted: true,
      propertyTransferRequest: true,
      interestStatus: "completed",
    },
  ];

  const rentFunnelSteps = [
    {
      funnelStatus: "interest sent",
      title: "Interest sent",
      image: "assets/img/dashboard/attractivity/attractivity-6.jpg",
      duration: "2:24",
    },
    {
      funnelStatus: "invite user for a visit",
      title: "Invite user for a visit",
      image: "assets/img/dashboard/attractivity/attractivity-7.jpg",
      duration: "2:10",
    },
    {
      funnelStatus: "visit accept by user",
      title: "Visit booked",
      image: "assets/img/dashboard/attractivity/attractivity-8.jpg",
      duration: "3:05",
      finalVisitDate: { date: "2026-06-12", from: "10:30", to: "11:15" },
    },
    {
      funnelStatus: "visit hosted",
      title: "Visit hosted",
      image: "assets/img/dashboard/attractivity/attractivity-9.jpg",
      duration: "2:12",
      finalVisitDate: { date: "2026-06-12", from: "10:30", to: "11:15" },
    },
    {
      funnelStatus: "review submit by user",
      title: "Visit review received",
      image: "assets/img/dashboard/attractivity/attractivity-10.jpg",
      duration: "2:57",
      review: { rating: 4.7, comment: "Visite bien déroulée, dossier en cours." },
    },
    {
      funnelStatus: "application submit by user",
      title: "Application file received",
      image: "assets/img/dashboard/attractivity/attractivity-6.jpg",
      duration: "2:40",
      applicationFile: {
        filename: "application-rent.pdf",
        submittedAt: "2026-06-10T09:00:00Z",
        status: "received",
      },
    },
    {
      funnelStatus: "owner accept the application",
      title: "You accepted the application",
      image: "assets/img/dashboard/attractivity/attractivity-7.jpg",
      duration: "3:00",
      applicationAccepted: true,
      interestStatus: "completed",
    },
  ];

  const saleCards = saleFunnelSteps.map((step, index) => {
    const buyer = guestBuyers[index];
    const score = buyer?.financialChecks?.financingProbability ?? 50;
    return {
      _id: `guest-interest-sale-${index + 1}`,
      buyerId: buyer,
      buyerName: buyer.fullName,
      propertyId: saleProperty,
      propertyType: "sale",
      funnelStatus: step.funnelStatus,
      status: "active",
      interestStatus: step.interestStatus ?? (step.funnelStatus === "confirmation by user" ? "completed" : "pending"),
      totalLeads: saleFunnelSteps.length,
      guestFlow: index + 1,
      offerStatus: step.offerStatus ?? false,
      applicationAccepted: step.applicationAccepted ?? false,
      interestType: step.interestType ?? "interest sent",
      makeOfferAmount: step.makeOfferAmount,
      makeOfferDescription: step.makeOfferDescription,
      makeOfferMovinDate: step.makeOfferMovinDate,
      makeOfferValidDate: step.makeOfferValidDate,
      buyerPrice: step.buyerPrice,
      ownerPrice: step.ownerPrice,
      finalPrice: step.finalPrice,
      review: step.review,
      documents: step.documents,
      finalSignSlot: step.finalSignSlot,
      finalSaleSlot: step.finalSaleSlot,
      finalContract: step.finalContract,
      userSigned: step.userSigned,
      ownerSigned: step.ownerSigned,
      propertyTransferRequest: step.propertyTransferRequest,
      userVisitDate: step.userVisitDate,
      ownerVisitDate: step.ownerVisitDate,
      finalVisitDate: step.finalVisitDate,
      financingReferenceScore: score,
      financingReferenceScoreSource: "auto",
      financingProbability: score,
      financialScore: score,
      financialScoreSource: "auto",
      scoreStatus: "OK",
      scoreClass: getScoreClass(score),
      scoreLabel: getScoreLabel(score),
      scoreQuantitative: 0,
      scoreQualitative: 0,
      topReasons: getGuestTopReasons(score, "sale"),
      funnel: {
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: step.title,
        image: step.image,
        duration: step.duration,
      },
    };
  });

  const renterScoreSteps = [65, 72, 78, 83, 88, 76];

  const rentCards = rentFunnelSteps.map((step, index) => {
    const buyer = guestBuyers[14 + index];
    const renterScore = renterScoreSteps[index] ?? 70;
    return {
      _id: `guest-interest-rent-${index + 1}`,
      buyerId: buyer,
      buyerName: buyer.fullName,
      propertyId: rentProperty,
      propertyType: "rent",
      funnelStatus: step.funnelStatus,
      status: "active",
      interestStatus: step.interestStatus ?? (step.funnelStatus === "owner accept the application" ? "completed" : "pending"),
      totalLeads: rentFunnelSteps.length,
      guestFlow: index + 1,
      offerStatus: step.offerStatus ?? false,
      applicationAccepted: step.applicationAccepted ?? false,
      interestType: step.interestType ?? "interest sent",
      applicationFile: step.applicationFile,
      buyerPrice: step.buyerPrice,
      finalHomeInventorySlot: step.finalHomeInventorySlot,
      finalSignSlot: step.finalSignSlot,
      propertyTransferRequest: step.propertyTransferRequest,
      financingReferenceScore: renterScore,
      financingReferenceScoreSource: "auto",
      financingProbability: renterScore,
      financialScore: renterScore,
      financialScoreSource: "auto",
      scoreStatus: "OK",
      scoreClass: getScoreClass(renterScore),
      scoreLabel: getScoreLabel(renterScore),
      scoreQuantitative: 0,
      scoreQualitative: 0,
      renterReferenceScore: renterScore,
      renterReferenceScoreSource: "auto",
      renterProbability: renterScore,
      renterScore: renterScore,
      renterScoreSource: "auto",
      renterScoreStatus: "OK",
      renterScoreClass: getScoreClass(renterScore),
      renterScoreLabel: getScoreLabel(renterScore),
      renterScoreQuantitative: 0,
      renterScoreQualitative: 0,
      renterTopReasons: getGuestTopReasons(renterScore, "rent"),
      funnel: {
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: step.title,
        image: step.image,
        duration: step.duration,
      },
    };
  });

  return [...saleCards, ...rentCards];
};

module.exports = {
    buildGuestInterestCards,

    addInterest: async (req, res) => {
        try {
            let {
                propertyId,
                buyerId,
                funnelStatus,
                makeOfferAmount,
                makeOfferDescription,
                makeOfferValidDate,
                makeOfferMovinDate
            } = req.body;
            // const userId = req.identity.id;
            let data = req.body;
            let data1 = req.body;
            if (!propertyId || !buyerId || !funnelStatus) {
                return res.status(400).json({
                    success: false,
                    message: "propertyId and buyerId are required.",
                });
            }

            const findInterest = await db.interests.findOne({
                isDeleted: false,
                propertyId,
                buyerId,
            })
            if (findInterest) {
                return res.status(400).json({
                    success: false,
                    message: "Interest already exists."
                })
            }
            const findBuyer = await db.users.findOne({
                _id: buyerId,
                isDeleted: false
            })
            if (!findBuyer) {
                return res.status(400).json({
                    success: false,
                    message: "Buyer doesn't exists."
                })
            }
            const property = await db.property.findOne({ _id: propertyId, isDeleted: false });
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found.",
                });
            }
            const isRental = String(property.propertyType || "").toLowerCase() === "rent";
            const scoringResult = isRental
                ? await scoreService.computeRenterScore({ declarativeRenterFiles: findBuyer.declarativeRenterFiles || {}, property })
                : await scoreService.computeFinancialScore({ declarativeBuyerFiles: findBuyer.declarativeBuyerFiles || {}, property });
            const referenceScore = scoringResult.score || 0;
            const financingProbability = referenceScore ? computeFinancingProbability(referenceScore, property) : 0;
            const maxLeadLimit = parseInt(property.maximumLead);
            const findExistingLeads = await db.interests.countDocuments({
                propertyId,
                funnelStatus: { $ne: "cancelled" },
                isDeleted: false
            })
            // let findExistingLeads = 1;
            console.log("MAXLEAD:", maxLeadLimit)
            console.log("findEXISTINGLEADS:", findExistingLeads);
            let allSlotsBooked = true;
            if (property.visitSlots && property.visitSlots.length > 0) {
                for (const slot of property.visitSlots) {
                    for (const time of slot.times) {
                        if (!time.booked) {
                            allSlotsBooked = false;
                            break;
                        }
                    }
                    if (!allSlotsBooked)
                        break;
                }
            }

            if (property.autoInvite && !allSlotsBooked && (maxLeadLimit > findExistingLeads)) {
                funnelStatus = "invite user for a visit";
            }

            if (property.addedBy.toString() === buyerId.toString()) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot show interest to your own property.",
                });
            }
            let interestType = "interest sent";
            let propertyType = property.propertyType;
            console.log("Funnel Status:", req.body.funnelStatus);
            console.log(typeof funnelStatus, funnelStatus);

            if (req.body.funnelStatus === "offer sent") {
                if (!makeOfferAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Please provide offer amount and movin date."
                    })
                }
                // console.log("Here", req.body)
                makeOfferDescription = makeOfferDescription ?? "No description provided";

                const makeAnOfferInterestCreate = await db.interests.create({
                    buyerId,
                    propertyId,
                    // funnelStatus: "Interest received",
                    funnelStatus,
                    status: "active",
                    propertyType,
                    interestStatus: "pending",
                    makeOfferAmount,
                    makeOfferDescription,
                    makeOfferMovinDate,
                    makeOfferValidDate,
                    interestType: "offer sent",
                    financingReferenceScore: referenceScore,
                    financingReferenceScoreSource: "auto",
                    financingProbability,
                    renterReferenceScore: referenceScore,
                    renterReferenceScoreSource: "auto",
                    renterProbability: financingProbability,
                    financialScore: scoringResult.score || 0,
                    financialScoreSource: "auto",
                    renterScore: scoringResult.score || 0,
                    renterScoreSource: "auto",
                    scoreStatus: scoringResult.score_status || "INSUFFICIENT_PROPERTY_DATA",
                    renterScoreStatus: scoringResult.score_status || "INSUFFICIENT_PROPERTY_DATA",
                    scoreClass: scoringResult.score_class || "",
                    renterScoreClass: scoringResult.score_class || "",
                    scoreLabel: scoringResult.score_label || "",
                    renterScoreLabel: scoringResult.score_label || "",
                    scoreQuantitative: scoringResult.score_quantitatif || 0,
                    renterScoreQuantitative: scoringResult.score_quantitatif || 0,
                    scoreQualitative: scoringResult.score_qualitatif || 0,
                    renterScoreQualitative: scoringResult.score_qualitatif || 0,
                    ratioFinancabilite: scoringResult.ratio_financabilite || 0,
                    capitalFinancable: scoringResult.capital_empruntable || 0,
                    besoinFinancement: scoringResult.besoin_financement || 0,
                    mensualiteDisponible: scoringResult.mensualite_disponible || 0,
                    priceSource: scoringResult.price_source || "",
                    priceReferenceProjet: scoringResult.price_reference_projet || 0,
                    referencePricePerSqm: scoringResult.reference_price_per_sqm || 0,
                    referencePricePostalCode: scoringResult.reference_price_postal_code || "",
                    surfaceUsedForReference: scoringResult.surface_used_for_reference || 0,
                    topReasons: scoringResult.top_reasons || [],
                    renterTopReasons: scoringResult.top_reasons || [],
                })

                const updatePropertyInterestTime = await db.property.updateOne(
                    { _id: propertyId, isDeleted: false },
                    {
                        $set: { interestUpdatedTime: new Date() },
                        $inc: { activityIndicatorCount: 1 }
                    }
                );

                let createNotification = await db.notifications.create({
                    sendTo: property.addedBy,
                    sendBy: buyerId,
                    property_id: propertyId,
                    status: "unread",
                    type: "interestStatus",
                    title: "Interest Activity",
                    message: `${findBuyer.firstName || findBuyer.lastName} has made an offer for ${property.propertyTitle}.`
                })

                data.interestId = makeAnOfferInterestCreate._id;
                data.addedBy = req.identity.id;
                data.interestType = interestType;
                const saveInterest = await db.interestTransactions.create(data)

                if (property.autoInvite && !allSlotsBooked) {
                    funnelStatus = "invite user for a visit";
                }

                if (property.autoInvite && !allSlotsBooked) {
                    const ownerDetail = await db.users.findById(property.addedBy)
                    // const buyerDetail = await db.users.findById(buyerId)
                    const email_payload = {
                        ownerEmail: ownerDetail?.email,
                        ownerName: formatDisplayName(ownerDetail),
                        propertyName: property?.propertyTitle || "",
                        buyerName: formatDisplayName(findBuyer),
                        buyerEmail: findBuyer.email,
                    };

                    await visitInvite.propertyVisitRequest(email_payload);

                    const buyerEmailPayload = {
                        ownerEmail: ownerDetail?.email,
                        ownerName: formatDisplayName(ownerDetail),
                        propertyName: property?.propertyTitle || "",
                        buyerName: formatDisplayName(findBuyer),
                        buyerEmail: findBuyer.email,
                    }
                    await visitInvite.buyerPropertyVisitRequest(buyerEmailPayload);
                }
                data1.funnelStatus = "invite user for a visit";
                const saveInviteTransaction = await db.interestTransactions.create(data1);

                if (maxLeadLimit >= findExistingLeads) {
                    return res.status(201).json({
                        success: true,
                        message: "Offer sent to the owner",
                        data: makeAnOfferInterestCreate,
                    });
                } else {
                    return res.status(201).json({
                        success: true,
                        message: "Maximun Leads exceeded for this property. You are in waiting list.",
                        data: makeAnOfferInterestCreate,
                    });
                }
            }

            const newInterest = new db.interests({
                buyerId,
                propertyId,
                // funnelStatus: "Interest received",
                funnelStatus,
                status: "active",
                propertyType,
                interestStatus: "pending",
                interestType,
                financingReferenceScore: referenceScore,
                financingReferenceScoreSource: "auto",
                financingProbability,
                renterReferenceScore: referenceScore,
                renterReferenceScoreSource: "auto",
                renterProbability: financingProbability,
                financialScore: scoringResult.score || 0,
                financialScoreSource: "auto",
                renterScore: scoringResult.score || 0,
                renterScoreSource: "auto",
                scoreStatus: scoringResult.score_status || "INSUFFICIENT_PROPERTY_DATA",
                renterScoreStatus: scoringResult.score_status || "INSUFFICIENT_PROPERTY_DATA",
                scoreClass: scoringResult.score_class || "",
                renterScoreClass: scoringResult.score_class || "",
                scoreLabel: scoringResult.score_label || "",
                renterScoreLabel: scoringResult.score_label || "",
                scoreQuantitative: scoringResult.score_quantitatif || 0,
                renterScoreQuantitative: scoringResult.score_quantitatif || 0,
                scoreQualitative: scoringResult.score_qualitatif || 0,
                renterScoreQualitative: scoringResult.score_qualitatif || 0,
                ratioFinancabilite: scoringResult.ratio_financabilite || 0,
                capitalFinancable: scoringResult.capital_empruntable || 0,
                besoinFinancement: scoringResult.besoin_financement || 0,
                mensualiteDisponible: scoringResult.mensualite_disponible || 0,
                priceSource: scoringResult.price_source || "",
                priceReferenceProjet: scoringResult.price_reference_projet || 0,
                referencePricePerSqm: scoringResult.reference_price_per_sqm || 0,
                referencePricePostalCode: scoringResult.reference_price_postal_code || "",
                surfaceUsedForReference: scoringResult.surface_used_for_reference || 0,
                topReasons: scoringResult.top_reasons || [],
                renterTopReasons: scoringResult.top_reasons || [],
            });


            const updatePropertyInterestTime = await db.property.updateOne(
                { _id: propertyId, isDeleted: false },
                {
                    $set: { interestUpdatedTime: new Date() },
                    $inc: { activityIndicatorCount: 1 }
                }
            );

            let saveNewInterest = await newInterest.save();
            logActivity(buyerId, "offer_sent", { label: `Intérêt envoyé pour ${property.propertyTitle || "un bien"}`, objectType: "property", objectId: propertyId, objectTitle: property.propertyTitle || "" });
            logPropertyActivity(propertyId, "offer_sent", { userId: buyerId, label: `Intérêt / Offre reçue` });
            let createNotification = await db.notifications.create({
                sendTo: property.addedBy,
                sendBy: buyerId,
                property_id: propertyId,
                status: "unread",
                type: "interestStatus",
                title: "Interest Activity",
                message: `${findBuyer.firstName || findBuyer.lastName} has shown interest in ${property.propertyTitle}.`
            })

            data.interestId = saveNewInterest._id;
            data.addedBy = req.identity.id;
            data.interestType = interestType;
            const saveInterest = await db.interestTransactions.create(data);

            if (property.autoInvite && !allSlotsBooked) {
                const ownerDetail = await db.users.findById(property.addedBy)
                // const buyerDetail = await db.users.findById(buyerId)
                const email_payload = {
                    ownerEmail: ownerDetail?.email,
                    ownerName: formatDisplayName(ownerDetail),
                    propertyName: property?.propertyTitle || "",
                    buyerName: formatDisplayName(findBuyer),
                    buyerEmail: findBuyer.email,
                };

                await visitInvite.propertyVisitRequest(email_payload);

                const buyerEmailPayload = {
                    ownerEmail: ownerDetail?.email,
                    ownerName: formatDisplayName(ownerDetail),
                    propertyName: property?.propertyTitle || "",
                    buyerName: formatDisplayName(findBuyer),
                    buyerEmail: findBuyer.email,
                }
                await visitInvite.buyerPropertyVisitRequest(buyerEmailPayload);
            }

            if (maxLeadLimit >= findExistingLeads) {
                return res.status(201).json({
                    success: true,
                    message: "Interest sent to the owner.",
                    data: newInterest,
                });
            } else {
                return res.status(201).json({
                    success: true,
                    message: "Maximun Leads exceeded for this property.You are in waiting list.",
                    data: newInterest,
                });
            }
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to add interest.",
                error: err.message
            });
        }
    },

    rateInterest: async (req, res) => {
        try {
            const { interestId, financingReferenceScore } = req.body;
            if (!interestId || financingReferenceScore == null) {
                return res.status(400).json({
                    success: false,
                    message: "interestId and financingReferenceScore are required.",
                });
            }

            const normalizedScore = normalizeScore(financingReferenceScore);
            if (normalizedScore === null) {
                return res.status(400).json({
                    success: false,
                    message: "financingReferenceScore must be a number between 0 and 100.",
                });
            }

            const interest = await db.interests.findOne({ _id: interestId, isDeleted: false });
            if (!interest) {
                return res.status(404).json({
                    success: false,
                    message: "Interest not found.",
                });
            }

            const buyer = await db.users.findOne({ _id: interest.buyerId, isDeleted: false });
            if (!buyer) {
                return res.status(404).json({
                    success: false,
                    message: "Buyer not found.",
                });
            }

            const property = await db.property.findOne({ _id: interest.propertyId, isDeleted: false });
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: "Property not found.",
                });
            }

            const loggedUserId = req.identity?.id;
            const loggedUser = await db.users.findOne({ _id: loggedUserId });
            if (!loggedUser || loggedUser.role !== "admin") {
                return res.status(403).json({
                    success: false,
                    message: "You are unauthorized to perform this action.",
                });
            }

            const financingProbability = computeFinancingProbability(normalizedScore, property);
            const scoreSource = (buyer.isDocumentVerified || buyer.isDeclDocumentVerified) ? "verified" : "admin";

            await db.users.updateOne(
                { _id: buyer._id, isDeleted: false },
                {
                    financingReferenceScore: normalizedScore,
                    financingReferenceScoreSource: scoreSource,
                    financingReferenceScoreUpdatedAt: new Date(),
                }
            );

            await db.interests.updateOne(
                { _id: interestId, isDeleted: false },
                {
                    financingReferenceScore: normalizedScore,
                    financingReferenceScoreSource: scoreSource,
                    financingProbability,
                }
            );

            return res.status(200).json({
                success: true,
                message: "Interest financing score updated successfully.",
                data: {
                    interestId,
                    financingReferenceScore: normalizedScore,
                    financingProbability,
                },
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: "Failed to update interest financing score.",
                error: err.message,
            });
        }
    },

    listInterest: async (req, res) => {
        try {
            const { buyerId, propertyId, propertyType } = req.query;
            let sorting = { updatedAt: -1 };
            if (!propertyId) {
                return res.status(400).json({
                    success: false,
                    message: "propertyId is required."
                });
            }

            const isGuestRequest =
                req.isGuest === true ||
                req.query.guest === true ||
                req.query.guest === "true" ||
                req.query.guest === "1" ||
                req.headers["x-guest-mode"] === true ||
                req.headers["x-guest-mode"] === "true" ||
                req.headers["x-guest-mode"] === "1";

            if (isGuestRequest) {
                const cards = buildGuestInterestCards(req);
                let filteredCards = cards;
                if (propertyId) {
                    filteredCards = filteredCards.filter(
                        (card) => card.propertyId?._id === propertyId
                    );
                }
                if (propertyType) {
                    filteredCards = filteredCards.filter(
                        (card) => card.propertyType === propertyType
                    );
                }
                const response = {
                    success: true,
                    message: "Guest interests fetched successfully.",
                    data: filteredCards,
                    total: filteredCards.length,
                    mockData: true,
                    isMock: true,
                };
                response.offerStatus = filteredCards.some((interest) => interest.offerStatus);
                response.applicationAccepted = filteredCards.some(
                    (interest) => interest.applicationAccepted
                );
                return res.status(200).json(response);
            }

            let propertyFilter = { propertyId, isDeleted: false };

            const buyerInterests = await db.interests.find(propertyFilter)
                .populate({
                    path: "propertyId",
                    select: "propertyTitle address zipcode images name location price propertyType city state country visitSlots changeRequestNote surface rooms bedrooms bathrooms bathroom propertyMonthlyCharges homeInventorySlots signingSlots contractSigned propertyTransferRequest addedBy identityVerified",
                    match: propertyType ? { propertyType: propertyType } : {}
                })
                .populate("buyerId", "fullName firstName lastName email city country image createdAt buyerfileIdenityVerification renterfileIdenityVerification isDocumentVerified isDeclDocumentVerified documentGrade financingReferenceScore financingReferenceScoreSource financingReferenceScoreUpdatedAt buyerFiles renterFiles declarativeRenterFiles")
                .sort(sorting)


            // const filteredData = buyerInterests.filter(interest => interest.propertyId !== null)
            //     .map(interest => ({
            //         ...interest.toObject(),
            //         property: interest.propertyId,
            //         buyer: interest.buyerId
            //     }));
            const filteredData = await Promise.all(
                buyerInterests
                    .filter(interest => interest.propertyId !== null)
                    .map(async (interest) => {
                        const funnelStatus = interest.funnelStatus?.trim();
                        // let youtubeUrl = null;
                        // let title = null;
                        let funnel = null;
                        if (funnelStatus) {
                            funnel = await db.funnelUrl.findOne({ funnelStatus, status: "active" }).select("youtubeUrl title tags type image status videoOwner duration");
                            if (funnel) {
                                // youtubeUrl = funnel.youtubeUrl;
                                // title = funnel.title;
                            }
                        }

                        const interestObj = interest.toObject();
                    const isRentalInterest = String(interestObj.propertyId?.propertyType || "").toLowerCase() === "rent";
                    
                    // Count properties created by this buyer/user
                    const propertiesCount = await db.property.countDocuments({
                        addedBy: interest.buyerId._id,
                        isDeleted: false
                    });
                    
                    const buyerScore = interestObj.financingReferenceScore > 0
                        ? interestObj.financingReferenceScore
                        : (interestObj.buyer?.financingReferenceScore > 0
                            ? interestObj.buyer.financingReferenceScore
                            : estimateScoreFromGrade(interestObj.buyer?.documentGrade));
                    const rentalScore = interestObj.renterReferenceScore > 0
                        ? interestObj.renterReferenceScore
                        : interestObj.renterScore > 0
                            ? interestObj.renterScore
                            : null;
                    const referenceScore = isRentalInterest
                        ? (rentalScore ?? buyerScore)
                        : buyerScore;
                    const responseFinancingProbability = interestObj.financingProbability > 0
                        ? interestObj.financingProbability
                        : computeFinancingProbability(referenceScore, interestObj.propertyId);
                    const responseFinancingReferenceScoreSource = isRentalInterest
                        ? (interestObj.renterReferenceScoreSource || interestObj.renterScoreSource || interestObj.financingReferenceScoreSource || ((interestObj.buyer?.isDocumentVerified || interestObj.buyer?.isDeclDocumentVerified) ? "verified" : "auto"))
                        : (interestObj.financingReferenceScoreSource
                            || interestObj.buyer?.financingReferenceScoreSource
                            || ((interestObj.buyer?.isDocumentVerified || interestObj.buyer?.isDeclDocumentVerified) ? "verified" : "auto"));

                    const buyerSupportingDocuments = hasBuyerSupportingDocuments(interestObj.buyer);

                    // Count properties created by buyer
                    const buyerPropertiesCount = await db.property.countDocuments({
                        addedBy: interestObj.buyerId,
                        isDeleted: false
                    });

                    return {
                            ...interestObj,
                            property: interest.propertyId,
                            buyer: { ...interest.buyerId.toObject(), propertiesOwned: propertiesCount },
                            buyerSupportingDocuments,
                            offerTransactions: await db.interestTransactions.find({
                                interestId: interestObj._id,
                                isDeleted: false,
                            }).sort({ createdAt: 1 }).lean(),
                            financingReferenceScore: referenceScore,
                            financingProbability: responseFinancingProbability,
                            financingReferenceScoreSource: responseFinancingReferenceScoreSource,
                            // youtubeUrl: youtubeUrl || null,
                            // title: title || null,
                            funnel: funnel || null,
                        };
                    })
            );
            const hasOfferAccepted = filteredData.some(interest => interest.offerStatus);
            const hasApplicationAccepted = filteredData.some(interest => interest.applicationAccepted);

            const response = {
                success: true,
                message: "Listings fetched successfully.",
                data: filteredData,
                total: filteredData.length
            };

            if (hasOfferAccepted) {
                response.offerStatus = true;
            } else {
                response.offerStatus = false
            }
            if (hasApplicationAccepted) {
                response.applicationAccepted = true;
            } else {
                response.applicationAccepted = false
            }

            return res.status(200).json(response);
        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch listings.",
                error: error.message
            });
        }
    },

    userInterests: async (req, res) => {
        try {
            const { buyerId, propertyType, isCompleted } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const isGuestRequest =
                req.isGuest === true ||
                req.query.guest === "true" ||
                req.headers["x-guest-mode"] === "true" ||
                req.headers["x-guest-mode"] === "1";

            if (isGuestRequest) {
                const cards = buildGuestInterestCards(req);
                let filteredCards = propertyType
                    ? cards.filter((card) => card.propertyType === propertyType)
                    : cards;
                
                if (isCompleted === 'true' || isCompleted === true) {
                    filteredCards = filteredCards.filter((card) => 
                        card.interestStatus === "completed" || 
                        card.funnelStatus === "confirmation by user" ||
                        card.funnelStatus === "owner accept the application"
                    );
                }
                
                const pagedCards = filteredCards.slice(skip, skip + limit);
                return res.status(200).json({
                    success: true,
                    message: "Guest interests fetched successfully.",
                    data: pagedCards,
                    total: filteredCards.length,
                });
            }

            if (!buyerId) {
                return res.status(400).json({
                    success: false,
                    message: "Payload missing: buyerId is required.",
                });
            }

            let sorting = { updatedAt: -1 };
            
            // Build filter for completed transactions
            let completedFilter = {};
            if (isCompleted === 'true' || isCompleted === true) {
                completedFilter = {
                    $or: [
                        { interestStatus: "completed" },
                        { funnelStatus: "confirmation by user" },
                        { funnelStatus: "owner accept the application" }
                    ]
                };
            }

            const findInterests = await db.interests.find({ 
                isDeleted: false, 
                buyerId: buyerId,
                ...completedFilter
            })
                .populate({
                    path: "propertyId",
                    match: propertyType ? { propertyType: propertyType } : {},
                    populate: {
                        path: "addedBy",
                        select: "fullName firstName lastName email city country image createdAt"
                    }
                })
                .sort(sorting)
                .skip(skip)
                .limit(limit)
                .lean();

            const filteredInterests = findInterests.filter(interest => interest.propertyId !== null);

            if (filteredInterests.length === 0) {
                return res.status(200).json({
                    success: false,
                    message: "No interests found for the given buyer and property type.",
                });
            }

            // const dataWithLeads = await Promise.all(
            //     filteredInterests.map(async (interest) => {
            //         const leadsCount = await db.interests.countDocuments({
            //             isDeleted: false,
            //             propertyId: interest.propertyId._id
            //         });
            //         return {
            //             ...interest,
            //             totalLeads: leadsCount
            //         };
            //     })
            // );

            const dataWithLeads = await Promise.all(
                filteredInterests.map(async (interest) => {
                    const leadsCount = await db.interests.countDocuments({
                        isDeleted: false,
                        propertyId: interest.propertyId._id
                    });

                    // let youtubeUrl = null;
                    // let title = null;
                    // let image = null;
                    // let type = null;
                    let funnel = null;
                    const funnelStatus = interest.funnelStatus;

                    if (funnelStatus) {
                        funnel = await db.funnelUrl.findOne({
                            funnelStatus: funnelStatus.trim(),
                            status: "active"
                        }).select('youtubeUrl title image type tags status videoOwner duration');

                        // if (funnel) {
                        //     youtubeUrl = funnel.youtubeUrl;
                        //     title = funnel.title;
                        //     image = funnel.image;
                        //     tags = funnel.tags;
                        //     type = funnel.type;
                        // }
                    }

                    return {
                        ...interest,
                        totalLeads: leadsCount,
                        offerTransactions: await db.interestTransactions.find({
                            interestId: interest._id,
                            isDeleted: false,
                        }).sort({ createdAt: 1 }).lean(),
                        // youtubeUrl: youtubeUrl || null,
                        // title: title || null,
                        funnel: funnel || null,
                    };
                })
            );

            if (dataWithLeads.length === 0) {
                return res.status(200).json({
                    success: false,
                    message: "No interests found for the given buyer and property type.",
                });
            }


            const totalInterests = await db.interests.countDocuments({
                isDeleted: false,
                buyerId: buyerId,
                ...(propertyType && { "propertyId.propertyType": propertyType })
            });

            return res.status(200).json({
                success: true,
                message: "Data fetched successfully.",
                data: dataWithLeads,
                total: filteredInterests.length,
            });

        }
        catch (error) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch user's intereted properties.",
                error: error.message
            });
        }
    },

    statusChange: async (req, res) => {
        try {
            const {
                funnelStatus,
                finalHomeInventorySlot,
                offerStatus,
                applicationAccepted,
                changeRequestNote,
                userConfirmation,
                ownerConfirmation,
                finalSale,
                ownerSale,
                userSale,
                finalContract,
                ownerContract,
                userContract,
                finalPresale,
                ownerSigned,
                userSigned,
                userPresale,
                ownerPresale,
                ownerVisitDate,
                finalVisitDate,
                userVisitDate,
                review,
                finalPrice,
                buyerPrice,
                icon1,
                icon2,
                icon3,
                icon4,
                icon5,
                icon6,
                icon7,
                ownerPrice,
                documents,
                applicationFile,
                finalSignSlot,
                interestId,
            } = req.body;

            let data = req.body;

            const interest = await db.interests.findOne(
                { _id: interestId, isDeleted: false }
            )
                .populate({
                    path: 'buyerId',
                    select: 'fullName email firstName lastName accountType username companyName'
                })
                .lean();
            if (!interest) {
                return res.status(404).json({
                    success: false,
                    message: "Interest not found"
                });
            }

            const buyerName = formatDisplayName(interest.buyerId);
            const buyerEmail = interest.buyerId?.email;

            if (funnelStatus === "offer accept by owner" && (finalPrice === undefined || typeof finalPrice !== "number")) {
                return res.status(400).json({
                    success: false,
                    message: "Final Price is required in case of offerAcceptence"
                })
            }


            if (interest.funnelStatus === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot change status after cancellation"
                });
            }

            let propertyId = interest.propertyId;
            const findProperty = await db.property.findOne({
                _id: propertyId,
                isDeleted: false
            })
                .populate({
                    path: "addedBy",
                    select: "fullName image email firstName lastName accountType username companyName"
                })
            const ownerName = formatDisplayName(findProperty.addedBy);
            const ownerEmail = findProperty.addedBy?.email;

            // FCM push notification helper
            const notifyUser = async (userId, title, message) => {
                await fcm_service.send_fcm_push_notification({
                    sendTo: userId,
                    title,
                    message,
                    property_id: propertyId?.toString() || ""
                });
            };

            const documentRequested =
                interest.documentRequested ||
                interest.funnelStatus === "buyer requested for document" ||
                interest.funnelStatus === "document send by owner" ||
                funnelStatus === "buyer requested for document" ||
                funnelStatus === "document send by owner";

            if (funnelStatus === "offer accepted" || funnelStatus === "application accepted") {
                let updateOffer = await db.property.updateOne({
                    _id: propertyId,
                    isDeleted: false
                }, {
                    $set: { offerStatus: true }
                })
            }

            if (funnelStatus === "buyer requested for document") {
                let createDocReqNotfication = await db.notifications.create({
                    sendTo: findProperty.addedBy,
                    sendBy: interest.buyerId,
                    property_id: propertyId,
                    status: "unread",
                    title: "user-seller-files-request-notification",
                    message: `${buyerName} has requested your seller files for property titled ${findProperty.propertyTitle}`
                })
                // FCM to owner
                await notifyUser(findProperty.addedBy._id, "Document Request", `${buyerName} has requested your seller files`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({
                    buyerName,
                    ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: ownerEmail,
                    propertyLink: redirectPath,
                    type: "buyerRequestedDocument"
                });
                console.log("Buyer document request notification done");
            }

            if (funnelStatus === "invite user for a visit") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Visit Invitation",
                    message: `${ownerName} has invited you to visit ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Visit Invitation", `${ownerName} has invited you to visit ${findProperty.propertyTitle}`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: redirectPath,
                    type: "visitInvitation"
                });
            }

            if (funnelStatus === "offer submit by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "New Offer",
                    message: `${ownerName} has submitted an offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "New Offer", `${ownerName} has submitted an offer for ${findProperty.propertyTitle}`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: redirectPath,
                    type: "ownerOfferSubmitted",
                    ownerPrice: ownerPrice || interest.ownerPrice,
                    buyerPrice: buyerPrice || interest.buyerPrice,
                });
            }

            if (funnelStatus === "preslot booked by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Inspection Slot Booked",
                    message: `${ownerName} has booked a pre-inspection slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Pre-Inspection Slot Booked", `${ownerName} has booked a pre-inspection slot`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: redirectPath,
                    type: "preslotBookedByOwner"
                });
            }

            if (funnelStatus === "signing date booked by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Signing Date Booked",
                    message: `${ownerName} has booked a signing date for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Signing Date Booked", `${ownerName} has booked a signing date`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: redirectPath,
                    type: "signingDateBookedByOwner"
                });
            }

            if (funnelStatus === "offer submit by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "New Offer Submitted",
                    message: `${buyerName} has submitted an offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "New Offer Submitted", `${buyerName} has submitted an offer`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: ownerEmail,
                    propertyLink: redirectPath,
                    type: "offerSubmittedByUser",
                    buyerPrice: buyerPrice || interest.buyerPrice
                });
            }

            if (funnelStatus === "offer accept by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Offer Accepted",
                    message: `${buyerName} has accepted your offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Offer Accepted", `${buyerName} has accepted your offer`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: ownerEmail,
                    propertyLink: redirectPath,
                    type: "offerAcceptByUser"
                });
            }

            if (funnelStatus === "preslot opened by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Inspection Slot Opened",
                    message: `${ownerName} has opened a pre-inspection slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Pre-Inspection Slot Opened", `${ownerName} has opened a pre-inspection slot`);
                let redirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: redirectPath,
                    type: "preslotOpenedByOwner"
                });
            }

            if (funnelStatus === "visit accept by user") {
                let updateVisitBookedCount = await db.property.updateOne({
                    _id: propertyId,
                    isDeleted: false
                }, {
                    $inc: { visitBookedCount: 1 }
                })

                // Log visit_request activity
                logPropertyActivity(propertyId, "visit_request", { userId: interest.buyerId, label: "Visite bookée" });

                if (finalVisitDate && finalVisitDate.date && finalVisitDate.from && finalVisitDate.to) {
                    const updateResult = await db.property.updateOne(
                        {
                            _id: propertyId,
                            isDeleted: false,
                            "visitSlots.date": finalVisitDate.date,
                            "visitSlots.times.from": finalVisitDate.from,
                            "visitSlots.times.to": finalVisitDate.to,
                            "visitSlots.times.date": finalVisitDate.date
                        },
                        {
                            $set: {
                                "visitSlots.$[outer].times.$[inner].booked": true,
                                "finalVisitDate": finalVisitDate // Also update the finalVisitDate field
                            }
                        },
                        {
                            arrayFilters: [
                                { "outer.date": finalVisitDate.date }, // Match the date group
                                {
                                    "inner.from": finalVisitDate.from,
                                    "inner.to": finalVisitDate.to,
                                    "inner.date": finalVisitDate.date
                                } // Match the exact time slot
                            ]
                        }
                    )
                }
                // Notify owner
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Visit Accepted",
                    message: `${buyerName} has accepted the visit for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Visit Accepted", `${buyerName} has accepted the visit`);
                const visitRedirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: ownerEmail,
                    propertyLink: visitRedirectPath,
                    type: "visitAcceptByUser"
                });
            }

            if (["contract signed by user", "contract signed by owner"].includes(funnelStatus)) {
                const updateProperty = await db.property.updateOne(
                    { _id: propertyId },
                    { contractSigned: true }
                )

                const contractEmailPayloadForOwner = {
                    ownerEmail,
                    propertyTitle: findProperty.propertyTitle,
                    buyerName,
                    ownerName
                };

                const contractEmailPayloadForBuyer = {
                    ownerEmail: buyerEmail,
                    propertyTitle: findProperty.propertyTitle,
                    buyerName: ownerName,
                    ownerName: buyerName,
                };

                if (funnelStatus === "contract signed by user") {
                    await db.notifications.create({
                        sendTo: findProperty.addedBy,
                        sendBy: interest.buyerId,
                        property_id: propertyId,
                        status: "unread",
                        title: "contract-signing-notification",
                        message: `${buyerName} has signed the contract for ${findProperty.propertyTitle}`
                    });
                    await notifyUser(findProperty.addedBy._id, "contract-signing-notification", `${buyerName} has signed the contract`);
                    contractEmailPayloadForOwner.signerName = buyerName;
                    contractEmailPayloadForBuyer.signerName = buyerName;
                    await sendEmail({
                        module: "AUTH",
                        to: ownerEmail,
                        subject: "Notification de signature de contrat",
                        templateId: constants.BREVO.CONTRACT_SIGNED_NOTIFICATION,
                        params: {
                            ownerName: contractEmailPayloadForOwner.ownerName || "",
                            signerName: contractEmailPayloadForOwner.signerName || "",
                            propertyTitle: findProperty.propertyTitle || "",
                            dashboardUrl: `${process.env.FRONT_WEB_URL}/dashboard`,
                        },
                    });
                }

                if (funnelStatus === "contract signed by owner") {
                    await db.notifications.create({
                        sendTo: interest.buyerId,
                        sendBy: findProperty.addedBy,
                        property_id: propertyId,
                        status: "unread",
                        title: "contract-signing-notification",
                        message: `${ownerName} has signed the contract for ${findProperty.propertyTitle}`
                    });
                    await notifyUser(interest.buyerId._id, "contract-signing-notification", `${ownerName} has signed the contract.`);
                    contractEmailPayloadForOwner.signerName = ownerName;
                    contractEmailPayloadForBuyer.signerName = buyerName;
                    await sendEmail({
                        module: "AUTH",
                        to: buyerEmail,
                        subject: "Notification de signature de contrat",
                        templateId: constants.BREVO.CONTRACT_SIGNED_NOTIFICATION,
                        params: {
                            ownerName: contractEmailPayloadForBuyer.ownerName || "",
                            signerName: contractEmailPayloadForBuyer.signerName || "",
                            propertyTitle: findProperty.propertyTitle || "",
                            dashboardUrl: `${process.env.FRONT_WEB_URL}/dashboard`,
                        },
                    });
                }

            }

            if (req.body.funnelStatus === "review submit by user" && review && typeof review === "object") {
                const addreview = db.reviews.create({
                    userId: interest.buyerId,
                    propertyId: interest.propertyId,
                    interestId: interestId,
                    location: review?.location,
                    luminosity: review?.luminosity,
                    condition: review?.condition,
                    areaCondition: review?.areaCondition,
                    propertyInformation: review?.propertyInformation,
                    peacefullSetting: review?.peacefullSetting,
                    note: review?.note
                });
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Review Submitted",
                    message: `${buyerName} has submitted a review for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Review Submitted", `${buyerName} has submitted a review.`);
                let reviewRedirectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: ownerEmail,
                    propertyLink: reviewRedirectPath,
                    type: "funnelReviewSubmitted"
                });
            }

            data.propertyId = propertyId;
            data.addedBy = req.identity.id;

            const createInterestTransaction = await db.interestTransactions.create(data)

            if (req.body.historyOnly) {
                return res.status(200).json({
                    success: true,
                    message: "History entry created successfully.",
                    data: createInterestTransaction,
                });
            }

            const updatedInterest = await db.interests.findByIdAndUpdate(
                interestId,
                {
                    funnelStatus,
                    finalPrice: finalPrice || interest.finalPrice,
                    buyerPrice: buyerPrice || interest.buyerPrice,
                    ownerPrice: ownerPrice || interest.ownerPrice,
                    documents: documents || interest.documents,
                    applicationFile: applicationFile || interest.applicationFile,
                    ownerVisitDate: ownerVisitDate || interest.ownerVisitDate,
                    finalVisitDate: finalVisitDate || interest.finalVisitDate,
                    userVisitDate: userVisitDate || interest.userVisitDate,
                    icon1: icon1 !== undefined ? icon1 : interest.icon1,
                    icon2: icon2 !== undefined ? icon2 : interest.icon2,
                    icon3: icon3 !== undefined ? icon3 : interest.icon3,
                    icon4: icon4 !== undefined ? icon4 : interest.icon4,
                    icon5: icon5 !== undefined ? icon5 : interest.icon5,
                    icon6: icon6 !== undefined ? icon6 : interest.icon6,
                    icon7: icon7 !== undefined ? icon7 : interest.icon7,
                    offerStatus: offerStatus !== undefined ? offerStatus : interest.offerStatus,
                    applicationAccepted: applicationAccepted !== undefined ? applicationAccepted : interest.applicationAccepted,
                    userConfirmation: userConfirmation !== undefined ? userConfirmation : interest.userConfirmation,
                    ownerConfirmation: ownerConfirmation !== undefined ? ownerConfirmation : interest.ownerConfirmation,
                    userSigned: userSigned !== undefined ? userSigned : interest.userSigned,
                    ownerSigned: ownerSigned !== undefined ? ownerSigned : interest.ownerSigned,
                    userContract: userContract || interest.userContract,
                    ownerContract: ownerContract || interest.ownerContract,
                    finalContract: finalContract || interest.finalContract,
                    ownerPresale: ownerPresale || interest.ownerPresale,
                    userPresale: userPresale || interest.userPresale,
                    finalPresale: finalPresale || interest.finalPresale,
                    userSale: userSale || interest.userSale,
                    ownerSale: ownerSale || interest.ownerSale,
                    finalSale: finalSale || interest.finalSale,
                    // review: review !== undefined ? review : interest.review,
                    review: review || interest.review,
                    documentRequested,
                    changeRequestNote: changeRequestNote || interest.changeRequestNote,
                    finalSignSlot: finalSignSlot || interest.finalSignSlot,
                    finalHomeInventorySlot: finalHomeInventorySlot || interest.finalHomeInventorySlot,
                },
                { new: true, lean: true }
            );

            if (funnelStatus === "offer accept by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Offer Accepted",
                    message: `${ownerName} has accepted your offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Offer Accepted", `${ownerName} has accepted your offer`);
                const offerAcceptPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: offerAcceptPath,
                    type: "offerAcceptByOwner"
                });
                const createTimeline = await db.timeline.create({
                    propertyId,
                    addedBy: req.identity.id,
                    type: "interestStatus",
                    finalPrice: finalPrice,
                    funnelStatus: "offer accepted"
                });
            }
            if (funnelStatus === "offer refused by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Offer Refused",
                    message: `${ownerName} has declined your offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Offer Refused", `${ownerName} has declined your offer`);
                const offerRefusePath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: offerRefusePath,
                    type: "offerRefusedByOwner"
                });
                const createTimeline = await db.timeline.create({
                    propertyId,
                    type: "interestStatus",
                    refusedPrice: Number(updatedInterest.buyerPrice.amount),
                    addedBy: req.identity.id,
                    funnelStatus: "offer refused"
                });
            }
            if (funnelStatus === "owner accept the application") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Application Accepted",
                    message: `${ownerName} has accepted your application for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Application Accepted", `${ownerName} has accepted your application`);
                const appAcceptPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: appAcceptPath,
                    type: "applicationAcceptedByOwner"
                });
                const createTimeline = await db.timeline.create({
                    propertyId,
                    type: "interestStatus",
                    addedBy: req.identity.id,
                    funnelStatus: "application refused"
                });
            }
            if (funnelStatus === "owner reject the application") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Application Rejected",
                    message: `${ownerName} has rejected your application for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Application Rejected", `${ownerName} has rejected your application`);
                const appRejectPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({
                    buyerName, ownerName,
                    propertyTitle: findProperty.propertyTitle,
                    email: buyerEmail,
                    propertyLink: appRejectPath,
                    type: "applicationRejectedByOwner"
                });
                const createTimeline = await db.timeline.create({
                    propertyId,
                    type: "interestStatus",
                    addedBy: req.identity.id,
                    funnelStatus: "application accepted"
                });
            }

            if (funnelStatus === "owner changed the slot") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Slot Changed",
                    message: `${ownerName} has changed the visit slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Slot Changed", `${ownerName} has changed the visit slot`);
                const slotChangedPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: slotChangedPath, type: "ownerChangedSlot" });
            }

            if (funnelStatus === "visit hosted") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Visit Completed",
                    message: `Your visit for ${findProperty.propertyTitle} has been completed`
                });
                await notifyUser(interest.buyerId._id, "How was your visit?", `Leave a review, request documents, make an offer, or let the owner know your decision.`);
                const visitHostedPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: visitHostedPath, type: "visitHosted" });

                // ── Dossier de visite : envoi automatique au candidat (une seule fois,
                // que ce soit le propriétaire ou le candidat qui confirme la visite) ──
                if (!interest.visitFolderSent) {
                    try {
                        const latestFolder = await db.visitFolder
                            .findOne({ propertyId, status: { $in: ["generated", "modified", "ready"] } })
                            .sort({ createdAt: -1 })
                            .lean();
                        if (latestFolder) {
                            const candidatePath = `${process.env.FRONT_WEB_URL || "http://localhost:8089"}/real-estate-transaction-searcher?interestId=${interestId}&openHistory=1`;
                            await visitFolderCtrl.sendVisitFolderByEmail({
                                folder: latestFolder,
                                email: buyerEmail,
                                candidateName: buyerName,
                                ownerName,
                                dashboardUrl: candidatePath,
                            });

                            await db.interestTransactions.findOneAndUpdate(
                                { interestId, funnelStatus: "visit hosted", isDeleted: false },
                                {
                                    $set: {
                                        visitFolder: {
                                            folderId: latestFolder._id,
                                            propertyId,
                                            destination: latestFolder.destination,
                                            generatedAt: latestFolder.generatedAt,
                                        },
                                    },
                                },
                                { sort: { createdAt: -1 } }
                            );

                            await db.notifications.create({
                                sendTo: interest.buyerId._id,
                                sendBy: findProperty.addedBy._id,
                                property_id: propertyId,
                                interestId,
                                status: "unread",
                                type: "visitFolder",
                                title: "Dossier de visite",
                                message: `Le dossier de visite de ${findProperty.propertyTitle} est disponible.`
                            });

                            await db.interests.updateOne({ _id: interestId }, { visitFolderSent: true });
                        }
                    } catch (err) {
                        console.error("Error auto-sending visit folder:", err);
                    }
                }
            }

            if (funnelStatus === "document send by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Documents Sent",
                    message: `${ownerName} has sent documents for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Documents Sent", `${ownerName} has sent documents for ${findProperty.propertyTitle}`);
                const docSentPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: docSentPath, type: "documentSentByOwner" });
            }

            if (funnelStatus === "offer refused by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Offer Refused",
                    message: `${buyerName} has refused your offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Offer Refused", `${buyerName} has refused your offer`);
                const offerRefusedByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: offerRefusedByUserPath, type: "offerRefusedByUser" });
            }

            if (funnelStatus === "offer sent") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "New Offer Received",
                    message: `${buyerName} has sent an offer for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "New Offer Received", `${buyerName} has sent an offer`);
                const offerSentPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: offerSentPath, type: "offerSent" });
            }

            if (funnelStatus === "saleslot booked by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Slot Booked",
                    message: `${ownerName} has booked a sale slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Sale Slot Booked", `${ownerName} has booked a sale slot`);
                const saleslotOwnerPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: saleslotOwnerPath, type: "saleslotBookedByOwner" });
            }

            if (funnelStatus === "saleslot accept by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Slot Accepted",
                    message: `${buyerName} has accepted the sale slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Sale Slot Accepted", `${buyerName} has accepted the sale slot.`);
                const saleslotAcceptByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: saleslotAcceptByUserPath, type: "saleslotAcceptedByUser" });
            }

            if (funnelStatus === "saleslot accept by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Slot Accepted",
                    message: `${ownerName} has accepted the sale slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Sale Slot Accepted", `${ownerName} has accepted the sale slot.`);
                const saleslotAcceptByOwnerPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: saleslotAcceptByOwnerPath, type: "saleslotAcceptedByOwner" });
            }

            if (funnelStatus === "confirmation by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Confirmed",
                    message: `${buyerName} has confirmed the sale process for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Sale Confirmed", `${buyerName} has confirmed the sale process.`);
                const confByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: confByUserPath, type: "confirmationByUser" });
            }

            if (funnelStatus === "confirmation by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Confirmed",
                    message: `${ownerName} has confirmed the sale process for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Sale Confirmed", `${ownerName} has confirmed the sale process.`);
                const confByOwnerPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: confByOwnerPath, type: "confirmationByOwner" });
            }

            if (funnelStatus === "request to change the pre-sale slot") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Slot Change Request",
                    message: `${buyerName} has requested to change the pre-sale slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Slot Change Request", `${buyerName} has requested to change the pre-sale slot`);
                const presaleChangePath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: presaleChangePath, type: "requestToChangePresaleSlot" });
            }

            if (funnelStatus === "owner changed the pre-signing slot") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Signing Slot Changed",
                    message: `${ownerName} has changed the pre-signing slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Pre-Signing Slot Changed", `${ownerName} has changed the pre-signing slot`);
                const presigningChangedPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: presigningChangedPath, type: "ownerChangedPresigningSlot" });
            }

            if (funnelStatus === "preslot accept by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Inspection Slot Accepted",
                    message: `${buyerName} has accepted the pre-inspection slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Pre-Inspection Slot Accepted", `${buyerName} has accepted the pre-inspection slot`);
                const preslotAcceptByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: preslotAcceptByUserPath, type: "preslotAcceptByUser" });
            }

            if (funnelStatus === "preslot booked by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Inspection Slot Booked",
                    message: `${buyerName} has booked a pre-inspection slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Pre-Inspection Slot Booked", `${buyerName} has booked a pre-inspection slot`);
                const preslotBookedByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: preslotBookedByUserPath, type: "preslotBookedByUser" });
            }

            if (funnelStatus === "preslot accept by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Pre-Inspection Slot Accepted",
                    message: `${ownerName} has accepted the pre-inspection slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Pre-Inspection Slot Accepted", `${ownerName} has accepted the pre-inspection slot`);
                const preslotAcceptByOwnerPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: preslotAcceptByOwnerPath, type: "preslotAcceptByOwner" });
            }

            if (funnelStatus === "home inventory accept by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Home Inventory Accepted",
                    message: `${buyerName} has accepted the home inventory for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Home Inventory Accepted", `${buyerName} has accepted the home inventory`);
                const homeInvAcceptPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: homeInvAcceptPath, type: "homeInventoryAcceptByUser" });
            }

            if (funnelStatus === "home inventory opened by owner") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Home Inventory Available",
                    message: `${ownerName} has opened the home inventory for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Home Inventory Available", `${ownerName} has opened the home inventory`);
                const homeInvOpenedPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: homeInvOpenedPath, type: "homeInventoryOpenedByOwner" });
            }

            if (funnelStatus === "request to change the home inventory slot") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Home Inventory Slot Change Request",
                    message: `${buyerName} has requested to change the home inventory slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Slot Change Request", `${buyerName} has requested to change the home inventory slot`);
                const homeInvChangePath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: homeInvChangePath, type: "requestToChangeHomeInventorySlot" });
            }

            // BONUS: lovepreet-specific status
            if (funnelStatus === "owner changed the home inventory slot") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Home Inventory Slot Changed",
                    message: `${ownerName} has changed the home inventory slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Home Inventory Slot Changed", `${ownerName} has changed the home inventory slot`);
                const homeInvChangedByOwnerPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: homeInvChangedByOwnerPath, type: "ownerChangedHomeInventorySlot" });
            }

            if (funnelStatus === "request to change the final signing slot") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Final Signing Slot Change Requested",
                    message: `${buyerName} has requested to change the final signing slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Final Signing Slot Change Requested", `${buyerName} has requested to change the final signing slot`);
                const finalSignChangePath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: finalSignChangePath, type: "requestToChangeFinalSigningSlot" });
            }

            if (funnelStatus === "request to change the visit slot") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Visit Slot Change Requested",
                    message: `${buyerName} has requested to change the visit slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Visit Slot Change Requested", `${buyerName} has requested to change the visit slot`);
                const visitSlotChangePath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: visitSlotChangePath, type: "requestToChangeVisitSlot" });
            }

            if (funnelStatus === "owner changed the final signing slot") {
                await db.notifications.create({
                    sendTo: interest.buyerId._id,
                    sendBy: findProperty.addedBy._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Final Signing Slot Updated",
                    message: `${ownerName} has updated the final signing slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(interest.buyerId._id, "Final Signing Slot Updated", `${ownerName} has updated the final signing slot`);
                const finalSignUpdatedPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher?user_id=${interest.buyerId._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: buyerEmail, propertyLink: finalSignUpdatedPath, type: "ownerChangedFinalSigningSlot" });
            }

            if (funnelStatus === "saleslot booked by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    title: "Sale Slot Booked",
                    message: `${buyerName} has booked a sale slot for ${findProperty.propertyTitle}`
                });
                await notifyUser(findProperty.addedBy._id, "Sale Slot Booked", `${buyerName} has booked a sale slot`);
                const saleslotByUserPath = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner?user_id=${findProperty.addedBy._id}`;
                await Emails.interestUpdateEmail({ buyerName, ownerName, propertyTitle: findProperty.propertyTitle, email: ownerEmail, propertyLink: saleslotByUserPath, type: "saleslotBookedByUser" });
            }

            if (funnelStatus === "application submit by user") {
                await db.notifications.create({
                    sendTo: findProperty.addedBy._id,
                    sendBy: interest.buyerId._id,
                    property_id: propertyId,
                    status: "unread",
                    type: "interestStatus",
                    title: "Documents Shared",
                    message: `${buyerName} has shared his documents for property titled ${findProperty.propertyTitle}.`
                });
                await notifyUser(findProperty.addedBy._id, "Documents Shared", `${buyerName} has shared his documents.`);
                await sendEmail({
                    module: "AUTH",
                    to: ownerEmail,
                    subject: "Documents partagés concernant votre propriété",
                    templateId: constants.BREVO.OWNER_DOCS_NOTIFY,
                    params: {
                        ownerName,
                        buyerName,
                        propertyTitle: findProperty.propertyTitle || "",
                        funnelLink: `${process.env.FRONT_WEB_URL}/funnel`,
                    },
                });
            }

            const updatePropertyInterestTime = await db.property.updateOne(
                { _id: propertyId, isDeleted: false },
                {
                    $set: { interestUpdatedTime: new Date() },
                    $inc: { activityIndicatorCount: 1 }
                }
            )

            return res.status(200).json({
                success: true,
                message: "Funnel status updated successfully",
                interest: updatedInterest
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },


    propertyTransfer: async (req, res) => {
        try {
            const { newOwner, propertyId, interestId } = req.body;

            if (!newOwner || !propertyId || !interestId) {
                return res.status(400).json({
                    success: false,
                    message: "Payload missing."
                })
            }
            const findProperty = await db.property.findOne({
                isDeleted: false,
                _id: propertyId
            })

            if (!findProperty) {
                return res.status(400).json({
                    success: false,
                    message: "Property not found!"
                });
            }

            const findExpireBuyers = await db.interests.find({
                propertyId,
                isDeleted: false,
                // interestStatus: "pending"
            })


            //bulk email send
            let buyerIds = findExpireBuyers.map((interest) => interest.buyerId)

            const users = await db.users.find(
                { _id: { $in: buyerIds } },
                { email: 1, _id: 1 }
            )

            // const emailMapping = users.reduce((acc, user) => {
            //     acc[user._id] = user.email;
            //     return acc;
            // }, {});
            const currentInterest = await db.interests.findOne({
                isDeleted: false,
                _id: interestId
            });
            if (!currentInterest) {
                return res.status(400).json({
                    success: false,
                    message: "Interest not found."
                })
            }

            const emailMapping = users.reduce((acc, user) => {
                if (user._id.toString() !== currentInterest.buyerId.toString()) {
                    acc[user._id] = user.email;
                }
                return acc;
            }, {});
            //bulk email send//

            console.log(emailMapping);
            const findUser = await db.users.findOne({
                isDeleted: false,
                _id: newOwner
            });

            if (!findUser) {
                return res.status(400).json({
                    success: false,
                    message: "User not found!"
                });
            }

            let oldOwner = findProperty.addedBy;
            if (!oldOwner) {
                return res.status(400).json({
                    success: false,
                    message: "Property owner not found!"
                });
            }
            const findOldOwner = await db.users.findOne({ _id: oldOwner, isDeleted: false });

            if ((newOwner) == (oldOwner)) {
                return res.status(400).json({
                    success: false,
                    message: "You can't transfer you own property to yourself."
                })
            }
            const countLeads = await db.interests.find({
                isDeleted: false,
                propertyId,
                //   interestStatus: "pending"
            })
                .populate('buyerId', 'image')

            const leadsImages = countLeads.map((lead) => lead.buyerId?.image || null).filter(Boolean);

            const findInterest = await db.interests.findOne({
                buyerId: newOwner,
                propertyId: propertyId,
                isDeleted: false
            })
                .populate("buyerId", "fullName email city country image createdAt");

            if (!findInterest) {
                return res.status(400).json({
                    success: false,
                    message: "Interest not found."
                })
            }

            if (findInterest._id != interestId) {
                return res.status(400).json({
                    success: false,
                    message: "propertyId, newOwner and interestId doesnot matched."
                })
            }

            const findIdByToken = await db.users.findOne({
                isDeleted: false,
                _id: req.identity.id
            })

            const updateOwner = await db.property.updateOne(
                { isDeleted: false, _id: propertyId }, {
                addedBy: newOwner,
                email: findUser.email,
                offerStatus: false,
                contractSigned: false,
                visitBookedCount: 0,
                activityIndicatorCount: 0,
                homeInventorySlots: [],
                signingSlots: [],
                autoInvite: false,
                sellerFiles: {},
                visitSlots: []
            })

            const createPropertyTransation = await db.propertyTransfers.create({
                newOwner: newOwner,
                oldOwner: oldOwner,
                transferDate: new Date(),
                transferStatus: "completed",
                propertyType: findProperty.propertyType,
                propertyId: propertyId,
            })

            const createTimeline = await db.timeline.create({
                oldOwner: findOldOwner.fullName,
                newOwner: findUser.fullName,
                addedBy: req.identity.id,
                transferDate: new Date(),
                propertyId: propertyId,
                type: "ownerChange"
            })

            const expireInterest = await db.interests.updateMany({
                isDeleted: false,
                propertyId: propertyId
            }, {
                interestStatus: "expired",
                OldOwnerData: {
                    image: findIdByToken.image,
                    fullName: findIdByToken.fullName,
                    email: findIdByToken.email,
                    country: findIdByToken.country,
                    createdAt: findIdByToken.createdAt,
                    totalLeads: (countLeads.length) - 1,
                    leadsImages,
                    address: findIdByToken.address
                },
                transferDone: true
            });

            const updateInterest = await db.interests.updateOne({
                _id: interestId
            }, {
                interestStatus: "completed",
                funnelStatus: "transferred"
            });

            const propertyLink = `${process.env.FRONT_WEB_URL}/property-details?id=${findProperty._id}`;

            for (const email of recipientEmails) {
                await sendEmail({
                    module: "AUTH",
                    to: email,
                    subject: "Confirmation de transfert de propriété",
                    templateId: constants.BREVO.PROPERTY_TRANSFER_CONFIRMATION,
                    params: {
                        transferorName: formatDisplayName(findOldOwner),
                        transfereeName: formatDisplayName(findUser),
                        propertyTitle: findProperty.propertyTitle || "",
                        propertyLink,
                    },
                });
                console.log("case: offer accepted");
            }
            const isRenterCase = false;
            await sendEmail({
                module: "AUTH",
                to: findUser.email,
                subject: "Confirmation de propriété",
                templateId: constants.BREVO.OWNER_CONGRATS_EMAIL,
                params: {
                    renterName: formatDisplayName(findUser),
                    ownerName: formatDisplayName(findOldOwner),
                    propertyTitle: findProperty.propertyTitle || "",
                    propertyLink,
                    mainMessage: `Nous sommes ravis de vous informer que vous avez acheté avec succès le bien "${findProperty.propertyTitle}" auprès de ${formatDisplayName(findOldOwner)}.`,
                    subMessage: `Félicitations pour votre nouvelle propriété !`,
                },
            });

            const saveHistory = await db.interestTransactions.create({
                interestId,
                funnelStatus: "transferred",
                propertyId,
                OldOwnerData: {
                    image: findIdByToken.image,
                    fullName: findIdByToken.fullName,
                    email: findIdByToken.email,
                    country: findIdByToken.country,
                    createdAt: findIdByToken.createdAt,
                    totalLeads: (countLeads.length) - 1,
                    leadsImages,
                    address: findIdByToken.address
                },
                transferDone: true,
                interestStatus: "completed",
            })

            return res.status(200).json({
                success: true,
                message: `${findUser.fullName} is the new owner of ${findProperty.propertyTitle}.`,
                data: {
                    findInterest,
                    propertyTitle: findProperty.propertyTitle,
                    propertyImages: findProperty.images,
                    transferDate: new Date()
                }
            })
        }
        catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    transferHistory: async (req, res) => {
        try {
            const { userId } = req.query;
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: "payload missing",
                })
            }
            const findTransferredProperties = await db.propertyTransfers.find({
                isDeleted: false,
                $or: [
                    { oldOwner: userId },
                    { owner: userId }
                ]
            });
            if (!findTransferredProperties || findTransferredProperties.length === 0) {
                return res.status(200).json({
                    success: false,
                    message: "You don't have any transferred properties yet."
                })
            }

            const propertyIds = findTransferredProperties.map((transfer) => transfer.propertyId);

            const expiredInterests = await db.interests.find({
                isDeleted: false,
                propertyId: { $in: propertyIds },
                interestStatus: "completed"
            })
                .populate({
                    path: "propertyId",
                    select: "propertyTitle address images"
                })
                .lean();

            if (!expiredInterests || expiredInterests.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No expired interests found for the transferred properties.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Here are the expired interests for your transferred properties.",
                data: expiredInterests,
            });

        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: "Failed to get history transfers.",
                error: err.message
            })
        }
    },

    expiredInterests: async (req, res) => {
        try {

            const { propertyId } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const findExpiredInterests = await db.interests.find({
                isDeleted: false,
                propertyId,
                transferDone: true
            })
                .populate({
                    path: "buyerId",
                    select: "fullName email image country city image createdAt propertiesOwned"
                })
                .populate({
                    path: "propertyId",
                    select: "id propertyTitle address zipcode propertyType images name location city state country bedroom bedrooms bathroom surface propertyMonthlyCharges visitSlots price"
                })
                .skip(skip)
                .limit(limit)
                .lean()

            return res.status(200).json({
                success: true,
                message: "Expired Interests.",
                data: findExpiredInterests
            })
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                Error: err.message
            });
        }
    },

    informUsers: async (req, res) => {
        try {
            const { interestId, funnelStatus } = req.body;

            // if(!interestId || !funnelStatus){
            //     return res.status(400).json({
            //         success: false,
            //         message: "Payload Missing."
            //     })
            // }

            const findInterest = await db.interests.findOne({ _id: interestId, isDeleted: false });
            // console.log(findInterest);
            let buyerId = findInterest.buyerId;
            let ownerPrice = findInterest.finalPrice;
            let finalPrice = findInterest.finalPrice;
            // console.log("object");
            let propertyId = findInterest.propertyId;
            const findBuyer = await db.users.findOne({
                _id: buyerId,
                isDeleted: false
            });
            let buyerName = formatDisplayName(findBuyer);
            const findProperty = await db.property.findOne({
                _id: propertyId,
                isDeleted: false
            })
                .populate({
                    path: "addedBy",
                    select: "fullName firstName lastName accountType username companyName"
                })

            let ownerId = findProperty.addedBy;
            const findOwner = await db.users.findOne({
                _id: ownerId, isDeleted: false
            })
            let propertyData = {
                ...findProperty.toObject(),
                ownerName: formatDisplayName(findProperty.addedBy)
            }

            const findInterestedUsers = await db.interests.find({
                propertyId,
                isDeleted: false,
                //    interestStatus: "pending",
            })

            let buyerIds = findInterestedUsers.map((interest) => interest.buyerId)
            console.log(buyerIds);

            const users = await db.users.find(
                { _id: { $in: buyerIds } },
                { email: 1, _id: 1 }
            )
            const emailMapping = users.reduce((acc, user) => {
                acc[user._id] = user.email;
                return acc;
            }, {});

            console.log(emailMapping);

            switch (funnelStatus) {
                case "offer accept by owner":

                    const recipientEmails = Object.values(emailMapping);

                    const offerAcceptedEmailPayload = recipientEmails.map((email) => ({
                        email: email,
                        buyerName: buyerName,
                        price: finalPrice,
                        type: "funnelOfferAccepted",
                        ownerName: propertyData.ownerName,
                        propertyTitle: findProperty.propertyTitle,
                        propertyLink: `http://195.35.8.196:8089/property-details?id=${findProperty._id}`
                    }));
                    for (const emailPayload of offerAcceptedEmailPayload) {
                        await Emails.interestUpdateEmail(emailPayload);
                        console.log("case: offer accepted");
                        console.log(emailPayload);
                    }
                    break;

                case "offer refused by owner":

                    const offerRefusedEmails = Object.values(emailMapping);

                    const offerRefusedEmailPayload = offerRefusedEmails.map((email) => ({
                        email: email,
                        buyerName: findBuyer.fullName,
                        price: ownerPrice,
                        type: "funnelOfferRefused",
                        ownerName: propertyData.ownerName,
                        propertyTitle: findProperty.propertyTitle,
                        propertyLink: `http://195.35.8.196:8089/property-details?id=${findProperty._id}`
                    }));
                    for (const emailPayload of offerRefusedEmailPayload) {
                        await Emails.interestUpdateEmail(emailPayload);
                        console.log("case: offer refused");
                        console.log(emailPayload);
                    }

                    break;

                case "owner reject the application":

                    const applicationRefusedEmails = Object.values(emailMapping);

                    const applicationRefusedEmailPayload = applicationRefusedEmails.map((email) => ({
                        email: email,
                        buyerName: findBuyer.fullName,
                        price: ownerPrice,
                        type: "funnelApplicationRefused",
                        ownerName: propertyData.ownerName,
                        propertyTitle: findProperty.propertyTitle,
                        propertyLink: `http://195.35.8.196:8089/property-details?id=${findProperty._id}`
                    }))

                    for (const emailPayload of applicationRefusedEmailPayload) {
                        await Emails.interestUpdateEmail(emailPayload);
                        console.log("case: aplication refused");
                        console.log(emailPayload);
                    }
                    break;

                case "owner accept the application":

                    const applicationAcceptedEmails = Object.values(emailMapping);

                    const applicationAcceptedEmailPayload = applicationAcceptedEmails.map((email) => ({
                        buyerName: findBuyer.fullName,
                        price: finalPrice,
                        type: "funnelApplicationAccepted",
                        ownerName: propertyData.ownerName,
                        propertyTitle: findProperty.propertyTitle,
                        propertyLink: `http://195.35.8.196:8089/property-details?id=${findProperty._id}`
                    }));

                    for (const emailPayload of applicationAcceptedEmailPayload) {
                        await Emails.interestUpdateEmail(emailPayload);
                        console.log("case: aplication accepted");
                        console.log(emailPayload);
                    }
                    break;

                case "offer submit by user":       // informing owner that buyer has shared his documnets

                    const sendSaleNotification = await db.notifications.create({
                        sendTo: ownerId,
                        sendBy: buyerId,
                        status: "unread",
                        property_id: propertyId,
                        type: "interestStatus",
                        title: "documents shared",
                        message: `${buyerName} has shared his documents for property titled ${findProperty.propertyTitle}.`
                    })
                    console.log("Owner notified sale case");
                    const emailPayloadSale = {
                        email: findOwner.email,
                        buyerName,
                        propertyTitle: findProperty.propertyTitle,
                        OwnerName: findOwner.fullName
                    }

                    const ownerDocsNotifyEmailSale = await sendEmail({
                        module: "AUTH",
                        to: findOwner.email,
                        subject: "Documents partagés concernant votre propriété",
                        templateId: constants.BREVO.OWNER_DOCS_NOTIFY,
                        params: {
                            ownerName: findOwner.fullName || "",
                            buyerName: buyerName || "",
                            propertyTitle: findProperty.propertyTitle || "",
                            funnelLink: `${process.env.FRONT_WEB_URL}/funnel`,
                        },
                    });
                    console.log("Email sent to owner sale case.");
                    break;

                case "application submit by user":
                    const sendRentNotification = await db.notifications.create({
                        sendTo: ownerId,
                        sendBy: buyerId,
                        status: "unread",
                        property_id: propertyId,
                        type: "interestStatus",
                        title: "documents shared",
                        message: `${buyerName} has shared his documents for property titled ${findProperty.propertyTitle}.`
                    })
                    console.log("Owner notified rent case");
                    const emailPayloadRent = {
                        email: findOwner.email,
                        buyerName,
                        propertyTitle: findProperty.propertyTitle,
                        OwnerName: findOwner.fullName
                    }

                    const ownerDocsNotifyEmailRent = await sendEmail({
                        module: "AUTH",
                        to: findOwner.email,
                        subject: "Documents partagés concernant votre propriété",
                        templateId: constants.BREVO.OWNER_DOCS_NOTIFY,
                        params: {
                            ownerName: findOwner.fullName || "",
                            buyerName: buyerName || "",
                            propertyTitle: findProperty.propertyTitle || "",
                            funnelLink: `${process.env.FRONT_WEB_URL}/funnel`,
                        },
                    });
                    console.log("Email sent to owner rent case.");
                    break;
            }

            return res.status(200).json({
                success: true,
                message: "Email and notification has been sent."
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                Error: err.message
            });
        }
    },

    interestMessages: async (req, res) => {
        try {
            const { interestId } = req.query;

            if (!interestId) {
                return res.status(400).json({
                    success: false,
                    message: "interestId is required."
                });
            }

            // Les IDs démo/guest ne sont pas des ObjectId valides → retourner
            // une liste vide plutôt qu'une erreur 500 (évite le déluge d'erreurs
            // sur les écrans de démo transaction-dashboard).
            if (!mongoose.Types.ObjectId.isValid(interestId)) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: { total: 0 }
                });
            }

            // const skip = (page - 1) * limit;

            const results = await db.interestTransactions
                .find({ interestId, isDeleted: false })
                .populate({
                    path: "propertyId",
                    select: "name location price propertyType city state country visitSlots changeRequestNote surface rooms bathrooms bathroom propertyMonthlyCharges homeInventorySlots signingSlots contractSigned propertyTransferRequest addedBy",
                    // match: propertyType ? { propertyType: propertyType } : {}
                })
                .populate("buyerId", "fullName email city country image createdAt ")
                .sort({ createdAt: 1 })
            // .skip(skip)
            // .limit(parseInt(limit));

            const totalCount = await db.interestTransactions.countDocuments({ interestId, isDeleted: false });

            return res.status(200).json({
                success: true,
                data: results,
                pagination: {
                    total: totalCount,
                    // page: parseInt(page),
                    // limit: parseInt(limit)
                }
            });
        } catch (err) {
            // Handle errors gracefully
            return res.status(500).json({
                success: false,
                message: "An error occurred while fetching interest transactions.",
                error: err.message
            });
        }
    },

    renterTransfer: async (req, res) => {
        try {

            const { interestId, funnelStatus } = req.body;
            let data = req.body;
            if (!interestId || !funnelStatus) {
                return res.status(400).json({
                    success: false,
                    message: "Id and funnelStatus is required."
                })
            }

            if (!["renter assigned", "renter transfered"].includes(funnelStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "can only be used for rental transfer"
                })
            }

            // if (funnelStatus !== "renter assigned" || funnelStatus !== "renter transfered") {
            //     return res.status(400).json({
            //         success: false,
            //         message: "can only be used for rental transfer"
            //     })
            // }
            const findInterest = await db.interests.findOne({
                isDeleted: false,
                _id: interestId
            })

            data.addedBy = req.identity.id;
            data.propertyId = findInterest.propertyId;
            const saveInterest = await db.interestTransactions.create(data);

            if (!findInterest) {
                return res.status(400).json({
                    success: false,
                    message: "Interest not found!"
                })
            }

            let propertyId = findInterest.propertyId;

            const findExpireBuyers = await db.interests.find({
                propertyId: propertyId,
                isDeleted: false,
                // interestStatus: "pending"
            })

            let buyerIds = findExpireBuyers.map((interest) => interest.buyerId)

            const users = await db.users.find(
                { _id: { $in: buyerIds } },
                { email: 1, _id: 1 }
            )

            // const emailMapping = users.reduce((acc, user) => {
            //     acc[user._id] = user.email;
            //     return acc;
            // }, {});


            const emailMapping = users.reduce((acc, user) => {
                if (user._id.toString() !== findInterest.buyerId.toString()) {
                    acc[user._id] = user.email;
                }
                return acc;
            }, {});

            const findProperty = await db.property.findOne({
                isDeleted: false,
                _id: propertyId
            })

            let propertyType = findProperty.propertyType;

            if (propertyType !== "rent") {
                return res.status(400).json({
                    success: false,
                    message: "This is a renting funnel."
                })
            }
            if (findProperty.addedBy === findInterest.buyerId) {
                return res.status(400).json({
                    success: false,
                    message: "You cannot rent your own property."
                })
            }

            const renterId = findInterest.buyerId;
            const findRenter = await db.users.findOne({ isDeleted: false, _id: renterId });
            let renterName = formatDisplayName(findRenter);
            const findOwner = await db.users.findOne({ isDeleted: false, _id: findProperty.addedBy })
            let ownerName = formatDisplayName(findOwner);

            const createRentTransaction = await db.propertyTransfers.create({
                renter: findInterest.buyerId,
                owner: findProperty.addedBy,
                transferDate: new Date(),
                propertyType: propertyType,
                transferStatus: "completed"
            })

            const createTimeline = await db.timeline.create({
                transferDate: new Date(),
                renter: renterName,
                owner: ownerName,
                addedBy: req.identity.id,
                type: "renterInterestStatus"
            });

            const changeType = await db.property.updateOne({ isDeleted: false, _id: propertyId }, {
                propertyType: "directory",
                offerStatus: false,
                contractSigned: false,
                visitBookedCount: 0,
                activityIndicatorCount: 0,
                homeInventorySlots: [],
                signingSlots: [],
                autoInvite: false,
                visitSlots: []
            })


            const recipientEmails = Object.values(emailMapping);

            const renterEmail = findRenter.email;
            const renterEmailPayload = {
                email: renterEmail,
                ownerName,
                renterName,
                propertyTitle: findProperty.propertyTitle,
                propertyLink: `https://book.jcsoftwaresolution.in/property-details?id=${findProperty._id}`,
                type: "renterCase"
            }

            await sendEmail({
                module: "AUTH",
                to: renterEmail,
                subject: "Confirmation de location",
                templateId: constants.BREVO.OWNER_CONGRATS_EMAIL,
                params: {
                    renterName: renterName || "",
                    ownerName: ownerName || "",
                    propertyTitle: findProperty.propertyTitle || "",
                    propertyLink: `${process.env.FRONT_WEB_URL}/property-details?id=${findProperty._id}`,
                    mainMessage: `Nous sommes ravis de vous informer que vous avez loué avec succès le bien "${findProperty.propertyTitle}" auprès de ${ownerName}.`,
                    subMessage: `Merci de votre confiance envers Bookaroo.`,
                },
            });

            if (recipientEmails.length > 0) {
                const emailPromises = recipientEmails.map(async (email) => {
                    try {
                        await sendEmail({
                            module: "AUTH",
                            to: email,
                            subject: "Transfert de locataire pour votre propriété",
                            templateId: constants.BREVO.RENTER_TRANSFER_NOTIFICATION,
                            params: {
                                propertyTitle: findProperty.propertyTitle || "",
                                propertyType: propertyType || "",
                                ownerName: ownerName || "",
                                renterName: renterName || "",
                                propertyLink: `${process.env.FRONT_WEB_URL}/property-details?id=${findProperty._id}`,
                            }
                        });
                        console.log("Email sent to:", email);
                    } catch (emailError) {
                        console.error("Error sending email to", email, ":", emailError.message);
                    }
                });

                await Promise.all(emailPromises);
                console.log("All emails processed");
            } else {
                console.log("No recipients to email");
            }

            const expireAllInterests = await db.interests.updateMany({
                isDeleted: false,
                propertyId,
                interestStatus: "pending",
                // transferDone: false
            },
                {
                    interestStatus: "expired",
                    transferDone: true,
                })
            const statusUpdated = await db.interests.updateOne({ _id: interestId }, { interestStatus: "completed", transferDone: true, funnelStatus })

            return res.status(200).json({
                success: true,
                message: 'Renter confirmed, property type changes to directory.',
            })


        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Some issue has occured',
                error: err.message
            })
        }
    },


    notifyOwner: async (req, res) => {
        try {

            let { interestId } = req.body;

            if (!interestId) {
                return res.status(400).json({
                    success: false,
                    message: "InterestId is required."
                })
            }

            let findInterest = await db.interests.findOne({
                _id: interestId,
                isDeleted: false,
                // transferDone: false,
                // interestStatus: "pending"
            });

            if (findInterest.funnelStatus === "cancelled" || findInterest.propertyType !== "sale") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot send as your request has been cancelled."
                })
            }

            if (!findInterest) {
                return res.status(400).json({
                    success: false,
                    message: "Interest not found."
                })
            }

            const findProperty = await db.property.findOne({ _id: findInterest.propertyId, isDeleted: false })
            if (!findProperty) {
                return res.status(400).json({
                    success: false,
                    message: "Property not found."
                })
            }

            let findBuyer = await db.users.findOne({ _id: findInterest.buyerId, isDeleted: false });
            if (!findBuyer) {
                return res.status(404).json({
                    success: false,
                    message: "Buyer not found."
                });
            }

            let findOwner = await db.users.findOne({ _id: findProperty.addedBy, isDeleted: false });
            if (!findOwner) {
                return res.status(404).json({
                    success: false,
                    message: "Owner not found."
                });
            }

            const updateProperty = await db.interests.updateOne({
                _id: interestId,
                isDeleted: false
            }, {
                propertyTransferRequest: true
            })


            let sendEmailResult = await sendEmail({
                module: "AUTH",
                to: findOwner.email,
                subject: "Demande de transfert de propriété",
                templateId: constants.BREVO.PROPERTY_TRANSFER_REQUEST,
                params: {
                    ownerName: findOwner.fullName || "",
                    buyerName: formatDisplayName(findBuyer),
                    propertyTitle: findProperty.propertyTitle || "",
                    dashboardUrl: `${process.env.FRONT_WEB_URL}/dashboard`,
                }
            });

            const createPropertyTransferNotification = await db.notifications.create({
                sendTo: findProperty.addedBy,
                sendBy: findInterest.buyerId,
                status: "unread",
                property_id: findInterest.propertyId,
                type: "interestStatus",
                title: "property-transfer-req-notification",
                message: `${findBuyer.firstName} is asking you to transfer the property titled ${findProperty.propertyTitle}.`
            });

            return res.status(200).json({
                success: true,
                message: "Owner has been notified to transfer the property.",
                notificationId: createPropertyTransferNotification._id
            });

        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: "Failed to notify the owner.",
                error: err.message
            })
        }
    },

    propertyBasedInterestTransactions: async (req, res) => {
        try {

            const { propertyId } = req.query;
            if (!propertyId) {
                return res.status(400).json({
                    success: false,
                    message: "Property ID is required"
                });
            }

            const findInterest = await db.interestTransactions.find({
                propertyId: propertyId,
                isDeleted: false
            })
                .lean()
                .sort("createdAt DESC");


            if (!findInterest || findInterest.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Interest not found for this property."
                })
            }

            const formattedData = findInterest.map(i => ({
                interestId: i.interestId,
                funnelStatus: i.funnelStatus
            }))
            return res.status(400).json({
                success: true,
                message: "Data fetched successfully",
                data: formattedData
            })
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: "Failed to fetch data",
                error: err.message
            })
        }
    }


}