const db = require("../models");
const QRCode = require("qrcode");
const mappingService = require("../services/visitFolderMapping.service");
const pdfService = require("../services/visitFolderPdf");
const pdfAssets = require("../services/visitFolderPdf/utils/assets");
const { sendEmail } = require("../config/brevo.config");
const constants = require("../utls/constants");
const path = require("path");
const fs = require("fs");

const PDF_DIR = path.join(__dirname, "../../public/uploads/visit-folders");

const _pdfPath = (folderId) => path.join(PDF_DIR, `${folderId}.pdf`);

const _generatePdfFile = async (folderId) => {
  const folder = await db.visitFolder.findById(folderId).lean();
  if (!folder) throw new Error("Dossier non trouvé.");

  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
  const pdfPath = _pdfPath(folderId);

  let property = await db.property.findById(folder.propertyId).populate("equipment outside ancilliary environment serviceAccessibility leisure cooking heatingType energymode").lean();
  if (!property) throw new Error("Bien non trouvé.");

  property.amenityLabels = [
    ...(property.equipment || []).filter(a => a?.title).map(a => a.title),
    ...(property.outside || []).filter(a => a?.title).map(a => a.title),
    ...(property.ancilliary || []).filter(a => a?.title).map(a => a.title),
    ...(property.environment || []).filter(a => a?.title).map(a => a.title),
    ...(property.serviceAccessibility || []).filter(a => a?.title).map(a => a.title),
    ...(property.leisure || []).filter(a => a?.title).map(a => a.title),
    ...(property.cooking || []).filter(a => a?.title).map(a => a.title),
    ...(property.heatingType?.title ? [property.heatingType.title] : []),
    ...(property.energymode?.title ? [property.energymode.title] : []),
  ];

  const snapshot = { ...folder.generatedSnapshot };
  snapshot.visitHighlights = folder.editableContent?.visitHighlights || "";
  snapshot.neighborhood = folder.editableContent?.neighborhood || "";
  snapshot.practicalLife = folder.editableContent?.practicalLife || "";
  snapshot.condominium = folder.editableContent?.condominium || "";
  snapshot.price = folder.editableContent?.price || (property.price != null ? String(property.price) : "");

  // Espaces mesurés (ceux saisis dans la modale) enrichis de leur picto
  const measured = mappingService.buildMeasuredSpaces(folder.editableContent?.spaces || []);
  const available = mappingService.buildAvailableSpaces(property);
  snapshot.spaces = measured.map((s) => {
    const match = available.find((a) => a.label === s.label) || available.find((a) => a.key === s.key);
    return { label: s.label, surface: s.surface, icon: match ? match.icon : "Ruler" };
  });

  // Plans du bien (1 ou 2 images uploadées dans la modale)
  snapshot.plans = (folder.editableContent?.plans || []).map((p) => ({
    fileName: p.fileName,
    originalname: p.originalname || "",
  }));

  // Prestations
  snapshot.prestations = mappingService.buildPrestationsSection(property).items;

  // Tableaux chiffrés + notations tierces
  const revenueLabels = {};
  const refTypes = new Set();
  (property.rating || []).forEach((r) => { if (r?.type) refTypes.add(String(r.type)); });
  (property.revenue_detail || []).forEach((r) => { if (r?.type) refTypes.add(String(r.type)); if (r?.source) refTypes.add(String(r.source)); });
  (property.Expenses || []).forEach((e) => { if (e?.type) refTypes.add(String(e.type)); });
  (property.renovation_work || []).forEach((w) => { if (w?.title) refTypes.add(String(w.title)); });
  const refIds = Array.from(refTypes).filter((t) => /^[a-f0-9]{24}$/i.test(t));
  if (refIds.length) {
    const revs = await db.revenue.find({ _id: { $in: refIds } }).lean();
    revs.forEach((r) => { revenueLabels[String(r._id)] = r.name; });
  }
  snapshot.tables = mappingService.buildTablesSection(property, folder.destination, revenueLabels, snapshot.price).tables;
  snapshot.externalRatings = mappingService.buildExternalRatings(property, revenueLabels);

  if (folder.editableContent?.valorizationItems?.length > 0) {
    const items = await db.valorizationItem
      .find({ _id: { $in: folder.editableContent.valorizationItems } })
      .lean();
    snapshot.valorizationItems = items.map((i) => ({ label: i.label, icon: i.icon || "" }));
  }

  const allDocs = extractSellerFileDocuments(property?.sellerFiles);
  const selectedIds = folder.editableContent?.selectedDocumentIds || [];
  snapshot.selectedDocuments = selectedIds.length > 0
    ? allDocs.filter((d) => selectedIds.includes(d.id))
    : allDocs.filter((d) => d.checked);
  snapshot.allDocuments = allDocs;

  // Contexte marque (couleur, logo, URL, nom) + QR code vers le profil du bien
  const owner = await db.users.findById(folder.addedBy).lean();
  if (!property.phoneNumber) property.phoneNumber = owner?.mobileNo || owner?.phoneNumber || "";
  const ctx = await _buildBrandContext(owner, property);
  snapshot.qrDataUrl = await QRCode.toDataURL(ctx.publicUrl, { errorCorrectionLevel: "H", margin: 1, width: 360 });

  // Compresser/redimensionner les images avant l'encodage base64 (photos + plans)
  // pour réduire drastiquement la taille du PDF généré.
  const selectedPhotoFiles = (folder.selectedPhotos || [])
    .map((p) => p.fileName || p.file)
    .filter(Boolean);
  const photoFiles = selectedPhotoFiles.length
    ? selectedPhotoFiles
    : (property.images || []).slice(0, 10).map((img) => img.file || img.fileName).filter(Boolean);
  const planFiles = (folder.editableContent?.plans || [])
    .map((p) => p.fileName)
    .filter(Boolean);
  await pdfAssets.optimizeImagesForPdf(photoFiles, { width: 1000, quality: 72 });
  await pdfAssets.optimizeImagesForPdf(planFiles, { width: 1000, quality: 85 });

  const html = pdfService.buildHtml(snapshot, folder.destination, folder.selectedPhotos, property, ctx);
  await pdfService.generatePdf(html, pdfPath);
};

// Envoie le PDF d'un dossier de visite par email (Brevo) — utilisé pour l'envoi
// automatique au candidat lors de la confirmation de la visite (Parcours Immo Digital).
const sendVisitFolderByEmail = async ({ folder, email, candidateName, ownerName, dashboardUrl }) => {
  try {
    if (!folder || !email) return false;
    const property = await db.property.findById(folder.propertyId).select("propertyTitle").lean();
    if (!property) return false;

    await _generatePdfFile(folder._id);
    const pdfPath = _pdfPath(folder._id);
    if (!fs.existsSync(pdfPath)) return false;

    const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
    const pdfFilename = `dossier-visite-${(property.propertyTitle || folder._id).replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    const result = await sendEmail({
      module: "AUTH",
      to: email.trim(),
      templateId: constants.BREVO.VISIT_FOLDER_SENT,
      params: {
        ownerName: ownerName || "L'agent",
        candidateName: candidateName || "",
        propertyTitle: property.propertyTitle || "",
        dashboardUrl: dashboardUrl || "",
      },
      attachment: [{ content: pdfBase64, name: pdfFilename }],
    });
    return result?.success === true;
  } catch (err) {
    console.error("Error in sendVisitFolderByEmail:", err);
    return false;
  }
};

// Construit l'URL de la vitrine en sous-domaine pour une marque blanche.
// FRONT_WEB_URL = "http://localhost:8089" ou "https://anyhomes.fr" →
// retourne "http://{slug}.localhost:8089" ou "https://{slug}.anyhomes.fr".
const buildWhiteLabelUrl = (base, slug) => {
  if (!slug) return base;
  try {
    const url = new URL(base);
    const parts = url.hostname.split(".");
    if (parts[0] === "www") parts.shift();
    url.hostname = `${slug}.${parts.join(".")}`;
    return url.origin;
  } catch (e) {
    return `${base}/${slug}`;
  }
};

const _buildBrandContext = async (owner, property) => {
  const FRONT_WEB_URL = process.env.FRONT_WEB_URL || "http://localhost:8089";

  // Remonter à l'agence pour les particuliers inscrits via une marque blanche
  // (le particulier n'a que whiteLabelAgencyId ; l'agence pro porte les paramètres).
  let brandUser = owner;
  if (owner?.whiteLabelAgencyId) {
    const agency = await db.users.findById(owner.whiteLabelAgencyId).lean();
    if (agency) brandUser = agency;
  }

  const isWhiteLabel = !!(brandUser?.whiteLabelActive && brandUser?.agencySlug);

  // URL de la vitrine (sous-domaine) pour la marque blanche, sinon AnyHomes
  const siteUrl = isWhiteLabel
    ? buildWhiteLabelUrl(FRONT_WEB_URL, brandUser.agencySlug)
    : "www.anyhomes.fr";

  // URL publique encodée dans le QR-code (profil du bien)
  const publicBase = isWhiteLabel
    ? buildWhiteLabelUrl(FRONT_WEB_URL, brandUser.agencySlug)
    : FRONT_WEB_URL;
  const publicUrl = `${publicBase}/property-details?id=${property._id}`;

  const brandColor = isWhiteLabel ? (brandUser?.buttonColor || "#976DD0") : "#976DD0";
  const hex = brandColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const rgb = [r, g, b].filter((n) => !isNaN(n)).join(", ") || "151, 109, 208";

  // Logo de la marque blanche : agencyLogo, sinon companyLogo du user (ex. logo Orpi)
  const brandLogoFile = (brandUser?.agencyLogo || brandUser?.companyLogo || "");

  // Logo pour la page de garde (fond photo violet) : version blanche
  let logoData = "";
  if (isWhiteLabel && brandLogoFile) {
    logoData = imgSrcPublic(brandLogoFile);
  }
  if (!logoData) {
    logoData = imgSrcPublic("anyhomes-logo-white.png");
  }

  // Logo pour les pages à fond blanc (bas-droite, page 7) : version full couleur
  let logoDataDark = "";
  if (isWhiteLabel && brandLogoFile) {
    logoDataDark = imgSrcPublic(brandLogoFile);
  }
  if (!logoDataDark) {
    logoDataDark = imgSrcPublic("anyhomes-full-logo.png") || logoDataDark;
  }

  return {
    brand: {
      color: brandColor,
      rgb,
      logoData,
      logoDataDark,
      url: siteUrl,
      name: isWhiteLabel ? (brandUser?.agencyName || "") : "AnyHomes",
      isWhiteLabel,
    },
    publicUrl,
  };
};

const imgSrcPublic = (file) => {
  if (!file) return "";
  const candidates = [
    path.join(__dirname, "../../public/img", file),
    path.join(__dirname, "../../public", file),
  ];
  for (const absPath of candidates) {
    try {
      if (!fs.existsSync(absPath)) continue;
      const ext = path.extname(file).toLowerCase().replace(".", "");
      const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/webp";
      const data = fs.readFileSync(absPath);
      return `data:${mime};base64,${data.toString("base64")}`;
    } catch (e) {}
  }
  return "";
};

const SELLER_FILE_CATEGORIES = [
  { key: "identityProof", label: "Pièce d'identité" },
  { key: "familySituation", label: "Justificatif de situation familiale" },
  { key: "addressProof", label: "Justificatif de domicile actuel" },
  { key: "carrezLaw", label: "Certificat de surface loi Carrez" },
  { key: "technicalDiagnostic", label: "Dossier de diagnostic technique" },
  { key: "coOwnership", label: "Règlement de copropriété" },
  { key: "personalContribution", label: "Apport personnel" },
  { key: "condominiumBooklet", label: "Carnet d'entretien de la copropriété" },
  { key: "minutesOfGeneral", label: "Procès-verbaux des assemblées générales de copropriétaires" },
  { key: "titleDeed", label: "Titre de propriété" },
  { key: "otherDocs", label: "Autres documents" },
];

const extractSellerFileDocuments = (sellerFiles) => {
  if (!sellerFiles || typeof sellerFiles !== "object") return [];
  const docs = [];
  SELLER_FILE_CATEGORIES.forEach((cat) => {
    const items = sellerFiles[cat.key];
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item?.fileName) {
          docs.push({
            id: item.id || item.fileName,
            docId: item.id,
            fileName: item.fileName,
            originalname: item.originalname || item.fileName,
            category: cat.key,
            categoryLabel: cat.label,
            checked: item.checked !== false,
          });
        }
      });
    }
  });
  return docs;
};

const getProperties = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const properties = await db.property
      .find({ addedBy: userId, isDeleted: false })
      .select("propertyTitle city zipcode price propertyType images type surface rooms createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const propIds = properties.map((p) => p._id);
    const folders = await db.visitFolder
      .find({ propertyId: { $in: propIds } })
      .sort({ createdAt: -1 })
      .lean();

    const folderMap = {};
    folders.forEach((f) => {
      if (!folderMap[String(f.propertyId)] || f.createdAt > folderMap[String(f.propertyId)].createdAt) {
        folderMap[String(f.propertyId)] = f;
      }
    });

    const data = properties.map((p) => {
      const folder = folderMap[String(p._id)] || null;
      const coverImage = p.images?.[0]?.file || null;
      return {
        _id: p._id,
        propertyTitle: p.propertyTitle,
        city: p.city,
        zipcode: p.zipcode,
        price: p.price,
        propertyType: p.propertyType,
        type: p.type,
        surface: p.surface,
        rooms: p.rooms,
        coverImage,
        visitFolder: folder
          ? {
              _id: folder._id,
              status: folder.status,
              version: folder.version,
              destination: folder.destination,
              generatedAt: folder.generatedAt,
            }
          : null,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Error in getProperties:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const generate = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const { propertyId, destination, price, selectedPhotoFileNames, visitHighlights, neighborhood, practicalLife, condominium, spaces, valorizationItemIds, selectedDocumentIds, plans } = req.body;
    if (!propertyId || !destination) {
      return res.status(400).json({ success: false, error: { code: 400, message: "propertyId et destination requis." } });
    }
    if (!["sale", "rent"].includes(destination)) {
      return res.status(400).json({ success: false, error: { code: 400, message: "Destination invalide." } });
    }

    const property = await db.property.findById(propertyId).lean();
    if (!property) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Bien non trouvé." } });
    }

    const selectedPhotos = (property.images || []).filter((img) =>
      (selectedPhotoFileNames || []).includes(img.file)
    ).map((img) => ({ fileName: img.file, originalname: img.file, order: 0 }));

    const snapshot = mappingService.buildSnapshot(property, destination, selectedPhotos);

    const editableContent = {
      visitHighlights: visitHighlights || "",
      neighborhood: neighborhood || "",
      practicalLife: practicalLife || "",
      condominium: condominium || "",
      price: price !== undefined && price !== "" ? String(price) : (property.price != null ? String(property.price) : ""),
      spaces: Array.isArray(spaces) ? spaces : [],
      valorizationItems: valorizationItemIds || [],
      selectedDocumentIds: selectedDocumentIds || [],
      plans: Array.isArray(plans) ? plans.slice(0, 2).map((p) => ({ fileName: p.fileName || "", originalname: p.originalname || "" })) : [],
    };

    let folder = await db.visitFolder.findOne({ propertyId, addedBy: userId }).sort({ createdAt: -1 });

    if (folder) {
      folder.status = "generated";
      folder.version = (folder.version || 0) + 1;
      folder.destination = destination;
      folder.selectedPhotos = selectedPhotos;
      folder.generatedSnapshot = snapshot;
      folder.editableContent = editableContent;
      folder.generatedAt = new Date();
      folder.modifiedAt = null;
      await folder.save();
    } else {
      folder = await db.visitFolder.create({
        propertyId,
        addedBy: userId,
        status: "generated",
        version: 1,
        destination,
        selectedPhotos,
        generatedSnapshot: snapshot,
        editableContent,
        generatedAt: new Date(),
      });
    }

    await _generatePdfFile(folder._id);

    return res.status(200).json({
      success: true,
      data: {
        _id: folder._id,
        status: folder.status,
        version: folder.version,
        destination: folder.destination,
        generatedAt: folder.generatedAt,
      },
    });
  } catch (err) {
    console.error("Error in generate:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const getById = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const folder = await db.visitFolder.findById(req.params.id).lean();
    if (!folder) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Dossier non trouvé." } });
    }

    const property = await db.property
      .findById(folder.propertyId)
      .populate("equipment outside serviceAccessibility ancilliary environment leisure cooking")
      .lean();
    const valorizationItems = await db.valorizationItem.find({ isActive: true }).sort({ order: 1 }).lean();

    const amenitiesLabels = [
      ...(property?.equipment || []).filter(a => a?.title).map(a => a.title),
      ...(property?.outside || []).filter(a => a?.title).map(a => a.title),
      ...(property?.ancilliary || []).filter(a => a?.title).map(a => a.title),
      ...(property?.serviceAccessibility || []).filter(a => a?.title).map(a => a.title),
      ...(property?.environment || []).filter(a => a?.title).map(a => a.title),
      ...(property?.leisure || []).filter(a => a?.title).map(a => a.title),
      ...(property?.cooking || []).filter(a => a?.title).map(a => a.title),
    ];

    return res.status(200).json({
      success: true,
      data: {
        folder,
        property: property
          ? {
              _id: property._id,
              propertyTitle: property.propertyTitle,
              propertyRef: property.propertyRef,
              city: property.city,
              zipcode: property.zipcode,
              address: property.address,
              price: property.price,
              propertyType: property.propertyType,
              type: property.type,
              surface: property.surface,
              landSurface: property.landSurface,
              rooms: property.rooms,
              bedrooms: property.bedrooms,
              bathroom: property.bathroom,
              livingRoom: property.livingRoom,
              office: property.office,
              diningRoom: property.diningRoom,
              toilets: property.toilets,
              propertyFloor: property.propertyFloor,
              totalFloorBuilding: property.totalFloorBuilding,
              building: property.building,
              situation: property.situation,
              usedAs: property.usedAs,
              attic: property.attic,
              garage: property.garage,
              gardenShed: property.gardenShed,
              energy_efficient: property.energy_efficient,
              energyConsumption: property.energyConsumption,
              emissions: property.emissions,
              emission_efficient: property.emission_efficient,
              images: property.images || [],
              amenitiesLabels,
              username: property.username,
              phoneNumber: property.phoneNumber,
              email: property.email,
            }
          : null,
        documents: extractSellerFileDocuments(property?.sellerFiles),
        valorizationItems,
      },
    });
  } catch (err) {
    console.error("Error in getById:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const update = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const { visitHighlights, neighborhood, practicalLife, condominium, price, spaces, valorizationItemIds, selectedPhotoFileNames, selectedDocumentIds, plans } = req.body;

    const folder = await db.visitFolder.findById(req.params.id);
    if (!folder) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Dossier non trouvé." } });
    }

    if (String(folder.addedBy) !== String(userId)) {
      return res.status(403).json({ success: false, error: { code: 403, message: "Non autorisé." } });
    }

    if (visitHighlights !== undefined) folder.editableContent.visitHighlights = visitHighlights;
    if (neighborhood !== undefined) folder.editableContent.neighborhood = neighborhood;
    if (practicalLife !== undefined) folder.editableContent.practicalLife = practicalLife;
    if (condominium !== undefined) folder.editableContent.condominium = condominium;
    if (price !== undefined && price !== "") folder.editableContent.price = String(price);
    if (spaces !== undefined) folder.editableContent.spaces = Array.isArray(spaces) ? spaces : [];
    if (valorizationItemIds !== undefined) folder.editableContent.valorizationItems = valorizationItemIds;
    if (selectedDocumentIds !== undefined) folder.editableContent.selectedDocumentIds = selectedDocumentIds;
    if (plans !== undefined) folder.editableContent.plans = Array.isArray(plans) ? plans.slice(0, 2).map((p) => ({ fileName: p.fileName || "", originalname: p.originalname || "" })) : [];
    if (selectedPhotoFileNames !== undefined) {
      const property = await db.property.findById(folder.propertyId).lean();
      folder.selectedPhotos = (property.images || []).filter((img) =>
        selectedPhotoFileNames.includes(img.file)
      ).map((img) => ({ fileName: img.file, originalname: img.file, order: 0 }));
    }

    folder.status = "modified";
    folder.modifiedAt = new Date();
    await folder.save();

    const cached = _pdfPath(req.params.id);
    if (fs.existsSync(cached)) fs.unlinkSync(cached);
    await _generatePdfFile(folder._id);

    return res.status(200).json({ success: true, data: { _id: folder._id, status: folder.status } });
  } catch (err) {
    console.error("Error in update:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const getPdf = async (req, res) => {
  try {
    const token = req.query.token;
    let userId = req.identity?._id;
    let userRole = req.identity?.role;
    if (!userId && token) {
      try {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
        userId = decoded._id || decoded.id;
        userRole = decoded.role || userRole;
      } catch (_) {}
    }
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const folder = await db.visitFolder.findById(req.params.id).lean();
    if (!folder) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Dossier non trouvé." } });
    }
    // Seul le propriétaire du dossier, l'acheteur du bien (candidat), ou un admin
    // peut télécharger le PDF (le candidat y accède depuis l'historique de la transaction).
    let authorized = String(folder.addedBy) === String(userId) || userRole === "admin";
    if (!authorized) {
      const candidateInterest = await db.interests
        .findOne({ propertyId: folder.propertyId, buyerId: userId, isDeleted: false })
        .select("_id")
        .lean();
      authorized = Boolean(candidateInterest);
    }
    if (!authorized) {
      return res.status(403).json({ success: false, error: { code: 403, message: "Non autorisé." } });
    }

    const property = await db.property.findById(folder.propertyId).select("propertyTitle").lean();
    if (!property) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Bien non trouvé." } });
    }

    const pdfPath = _pdfPath(folder._id);
    try {
      await _generatePdfFile(folder._id);
    } catch (err) {
      console.error("Error in getPdf regeneration:", err);
      if (!fs.existsSync(pdfPath)) {
        return res.status(500).json({ success: false, error: { code: 500, message: "Génération du PDF impossible." } });
      }
    }

    return res.download(pdfPath, `dossier-visite-${property.propertyTitle || folder._id}.pdf`);
  } catch (err) {
    console.error("Error in getPdf:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const getValorizationItems = async (req, res) => {
  try {
    const items = await db.valorizationItem.find({ isActive: true }).sort({ order: 1 }).lean();
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    console.error("Error in getValorizationItems:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const remove = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const folder = await db.visitFolder.findById(req.params.id).lean();
    if (!folder) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Dossier non trouvé." } });
    }
    // Seul le propriétaire du dossier (ou un admin) peut télécharger le PDF
    if (String(folder.addedBy) !== String(userId) && req.identity?.role !== "admin") {
      return res.status(403).json({ success: false, error: { code: 403, message: "Non autorisé." } });
    }
    if (String(folder.addedBy) !== String(userId)) {
      return res.status(403).json({ success: false, error: { code: 403, message: "Non autorisé." } });
    }

    const cached = _pdfPath(folder._id);
    if (fs.existsSync(cached)) fs.unlinkSync(cached);
    await db.visitFolder.deleteOne({ _id: folder._id });
    return res.status(200).json({ success: true, message: "Dossier supprimé." });
  } catch (err) {
    console.error("Error in remove:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const send = async (req, res) => {
  try {
    const userId = req.identity?._id;
    if (!userId) return res.status(401).json({ success: false, error: { code: 401, message: "Authentification requise." } });

    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, error: { code: 400, message: "Au moins un email requis." } });
    }

    const folder = await db.visitFolder.findById(req.params.id).lean();
    if (!folder) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Dossier non trouvé." } });
    }

    const property = await db.property.findById(folder.propertyId).lean();
    if (!property) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Bien non trouvé." } });
    }
    const pdfPath = _pdfPath(folder._id);
    if (!fs.existsSync(pdfPath)) {
      return res.status(400).json({ success: false, error: { code: 400, message: "Le PDF n'a pas encore été généré. Veuillez d'abord télécharger le dossier." } });
    }

    const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
    const pdfFilename = `dossier-visite-${(property.propertyTitle || folder._id).replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    const user = await db.users.findById(userId).lean();
    const ownerName = user?.fullName || user?.firstName || "L'agent";

    const { BrevoClient } = require("@getbrevo/brevo");
    const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

    for (const email of emails) {
      if (!email || typeof email !== "string") continue;
      try {
        await brevo.transactionalEmails.sendTransacEmail({
          sender: { email: process.env.BREVO_AUTH_FROM_EMAIL || "noreply@anyhomes.fr", name: process.env.BREVO_AUTH_FROM_NAME || "AnyHomes" },
          to: [{ email: email.trim() }],
          subject: `Dossier de visite - ${property.propertyTitle || "Bien immobilier"}`,
          htmlContent: `<p>Bonjour,</p><p>Veuillez trouver ci-joint le dossier de visite pour <strong>${property.propertyTitle || "le bien"}</strong>.</p><p>Cordialement,<br/>${ownerName}</p>`,
          attachment: [{ content: pdfBase64, name: pdfFilename }],
        });
      } catch (emailErr) {
        console.error(`Failed to send to ${email}:`, emailErr.message);
      }
    }

    return res.status(200).json({ success: true, message: "Email(s) envoyé(s) avec succès." });
  } catch (err) {
    console.error("Error in send:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

module.exports = { getProperties, generate, getById, update, getPdf, getValorizationItems, remove, send, sendVisitFolderByEmail };
