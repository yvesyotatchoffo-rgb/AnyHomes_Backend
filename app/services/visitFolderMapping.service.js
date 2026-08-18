const isFilled = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === "object" && Object.keys(value).length === 0) return false;
  return true;
};

const shouldShowSection = (fields) => {
  return fields.some((f) => f.visible);
};

const shouldShowCriticalSection = (rawItems) => {
  return Array.isArray(rawItems) && rawItems.length > 0;
};

const shouldShowEngagementBlock = (engagement) => {
  return (
    isFilled(engagement?.views) ||
    isFilled(engagement?.likes) ||
    isFilled(engagement?.shares) ||
    isFilled(engagement?.messages) ||
    isFilled(engagement?.followers)
  );
};

const formatCurrency = (value) => {
  if (!value && value !== 0) return null;
  return Number(value).toLocaleString("fr-FR") + " €";
};

const formatNumber = (value) => {
  if (!value && value !== 0) return null;
  return Number(value).toLocaleString("fr-FR");
};

const buildCoverSection = (property) => {
  const fields = [
    { key: "propertyTitle", label: "Titre du bien", value: property.propertyTitle, visible: isFilled(property.propertyTitle) },
    { key: "propertyRef", label: "Référence", value: property.propertyRef, visible: isFilled(property.propertyRef) },
    { key: "city", label: "Ville", value: property.city, visible: isFilled(property.city) },
    { key: "zipcode", label: "Code postal", value: property.zipcode, visible: isFilled(property.zipcode) },
    { key: "address", label: "Adresse", value: property.address, visible: isFilled(property.address) },
    { key: "price", label: "Prix", value: formatCurrency(property.price), visible: isFilled(property.price) },
    { key: "surface", label: "Surface", value: formatNumber(property.surface) + " m²", visible: isFilled(property.surface) },
    { key: "rooms", label: "Pièces", value: property.rooms, visible: isFilled(property.rooms) },
    { key: "bedrooms", label: "Chambres", value: property.bedrooms, visible: isFilled(property.bedrooms) },
  ];
  return { fields, visible: shouldShowSection(fields) };
};

const buildSummarySection = (property) => {
  const fields = [
    { key: "type", label: "Type de bien", value: property.type, visible: isFilled(property.type) },
    { key: "surface", label: "Surface", value: formatNumber(property.surface) + " m²", visible: isFilled(property.surface) },
    { key: "rooms", label: "Pièces", value: property.rooms, visible: isFilled(property.rooms) },
    { key: "bedrooms", label: "Chambres", value: property.bedrooms, visible: isFilled(property.bedrooms) },
    { key: "bathroom", label: "Salle de bain", value: property.bathroom, visible: isFilled(property.bathroom) },
    { key: "toilets", label: "Toilettes", value: property.toilets, visible: isFilled(property.toilets) },
    { key: "propertyFloor", label: "Étage", value: property.propertyFloor, visible: isFilled(property.propertyFloor) },
    { key: "totalFloorBuilding", label: "Immeuble de", value: property.totalFloorBuilding, visible: isFilled(property.totalFloorBuilding) },
    { key: "building", label: "Année construction", value: property.building, visible: isFilled(property.building) },
    { key: "situation", label: "Situation", value: Array.isArray(property.situation) ? property.situation.join(", ") : property.situation, visible: isFilled(property.situation) },
    { key: "landSurface", label: "Surface terrain", value: formatNumber(property.landSurface) + " m²", visible: isFilled(property.landSurface) },
    { key: "usedAs", label: "Usage", value: property.usedAs, visible: isFilled(property.usedAs) },
  ];
  return { fields, visible: shouldShowSection(fields) };
};

const buildMediaSection = (property, selectedPhotos) => {
  const photos = (selectedPhotos || []).length > 0 ? selectedPhotos : (property.images || []);
  return {
    photos: photos.slice(0, 8),
    totalAvailable: (property.images || []).length,
    visible: photos.length > 0,
  };
};

const buildEnvironmentSection = (property) => {
  const fields = [
    { key: "address", label: "Adresse", value: property.address, visible: isFilled(property.address) },
    { key: "city", label: "Ville", value: property.city, visible: isFilled(property.city) },
    { key: "zipcode", label: "Code postal", value: property.zipcode, visible: isFilled(property.zipcode) },
  ];
  return { fields, visible: shouldShowSection(fields) };
};

const buildKeyFiguresSection = (property, destination) => {
  const fields = [
    { key: "price", label: "Prix", value: formatCurrency(property.price), visible: isFilled(property.price) },
    { key: "pricePerSqm", label: "Prix/m²", value: formatCurrency(property.pricePerSqm || property.pricePerSquareMeter), visible: isFilled(property.pricePerSqm || property.pricePerSquareMeter) },
    { key: "referencePrice", label: "Prix de référence", value: formatCurrency(property.referencePrice), visible: isFilled(property.referencePrice) },
    { key: "propertyCharges", label: "Charges annuelles", value: formatCurrency(property.propertyCharges), visible: isFilled(property.propertyCharges) },
    { key: "propertyAgencyFees", label: "Honoraires", value: formatCurrency(property.propertyAgencyFees), visible: isFilled(property.propertyAgencyFees) },
    { key: "propertyMonthlyCharges", label: "Charges mensuelles", value: formatCurrency(property.propertyMonthlyCharges), visible: destination === "rent" && isFilled(property.propertyMonthlyCharges) },
    { key: "guaranteeDeposit", label: "Dépôt de garantie", value: formatCurrency(property.guaranteeDeposit), visible: destination === "rent" && isFilled(property.guaranteeDeposit) },
    { key: "energyConsumption", label: "Consommation énergétique", value: property.energyConsumption + " kWh/m²/an", visible: isFilled(property.energyConsumption) },
    { key: "energy_efficient", label: "DPE", value: property.energy_efficient, visible: isFilled(property.energy_efficient) },
    { key: "emissions", label: "Émissions GES", value: property.emissions + " kg CO₂/m²/an", visible: isFilled(property.emissions) },
    { key: "emission_efficient", label: "GES", value: property.emission_efficient, visible: isFilled(property.emission_efficient) },
    { key: "diagnosisDate", label: "Date du diagnostic", value: property.diagnosisDate, visible: isFilled(property.diagnosisDate) },
  ];
  return { fields, visible: shouldShowSection(fields) };
};

const buildValueHistorySection = (property, destination) => {
  const sections = [];

  if (shouldShowCriticalSection(property.renovation_work)) {
    sections.push({
      key: "renovations",
      title: "Travaux réalisés",
      items: (property.renovation_work || []).map((w) => ({
        title: w.title,
        description: w.description,
        price: w.price,
        date: w.renovationDate,
        status: w.status,
      })),
      visible: true,
    });
  }

  if (shouldShowCriticalSection(property.revenue_detail) && destination !== "rent") {
    sections.push({
      key: "revenues",
      title: "Revenus générés",
      items: (property.revenue_detail || []).map((r) => ({
        type: r.type,
        source: r.source,
        year: r.year,
        price: r.price,
        status: r.status,
      })),
      visible: true,
    });
  }

  if (shouldShowCriticalSection(property.Expenses)) {
    sections.push({
      key: "expenses",
      title: "Dépenses",
      items: (property.Expenses || []).map((e) => ({
        type: e.type,
        year: e.year,
        price: e.price,
      })),
      visible: true,
    });
  }

  if (shouldShowCriticalSection(property.rating)) {
    sections.push({
      key: "ratings",
      title: "Notations externes",
      items: (property.rating || []).map((r) => ({
        type: r.type,
        value: r.rating_value,
        url: r.url,
      })),
      visible: true,
    });
  }

  return { sections, visible: sections.length > 0 };
};

const buildEngagementSection = (property) => {
  const engagement = {
    views: property.propertyViewerCount,
    likes: property.favoriteCount,
    shares: property.shareCount,
    followers: (property.follow || []).length,
  };
  const visible = shouldShowEngagementBlock(engagement);
  return { ...engagement, visible };
};

const buildNextStepsSection = () => {
  return {
    visible: true,
    fields: [
      { key: "step1", label: "Vous avez visité ce bien", value: "Faites le point avec votre entourage", visible: true },
      { key: "step2", label: "Une question ?", value: "Contactez le propriétaire pour plus d'informations", visible: true },
      { key: "step3", label: "Prêt à passer à l'action ?", value: "Faire une offre / Candidater", visible: true },
    ],
  };
};

// ─── Espaces mesurables (Page 2 - bloc "Superficie des principaux espaces") ───
const SPACE_LABELS = [
  { label: "Salle de bain", key: "bathroom", icon: "Bath" },
  { label: "Chambre", key: "bedrooms", icon: "BedDouble" },
  { label: "Séjour", key: "livingRoom", icon: "Sofa" },
  { label: "Bureau", key: "office", icon: "Briefcase" },
  { label: "Salle à manger", key: "diningRoom", icon: "Utensils" },
];

const AMENITY_SPACE_MAP = [
  { match: /cuisine/i, label: "Cuisine", icon: "ChefHat" },
  { match: /cave/i, label: "Cave", icon: "Warehouse" },
  { match: /v.rada/i, label: "Véranda", icon: "Sun" },
  { match: /jardin/i, label: "Jardin", icon: "Trees" },
  { match: /terrasse/i, label: "Terrasse", icon: "Sunset" },
  { match: /balcon/i, label: "Balcon", icon: "Wind" },
  { match: /buanderie/i, label: "Buanderie", icon: "WashingMachine" },
  { match: /local.*v.lo|v.lo/i, label: "Local à vélo", icon: "Bike" },
  { match: /\bbox\b/i, label: "Box", icon: "Package" },
];

const BOOL_SPACE_MAP = [
  { field: "attic", label: "Grenier", icon: "Archive" },
  { field: "garage", label: "Garage", icon: "Car" },
  { field: "gardenShed", label: "Abri de jardin", icon: "Tent" },
];

// Liste des espaces "mesurables" détectés sur le bien (compteurs + amenities + booléens).
const buildAvailableSpaces = (property) => {
  const spaces = [];

  // Compteurs → espaces numérotés
  SPACE_LABELS.forEach((def) => {
    const count = Number(property?.[def.key]);
    if (count > 0) {
      for (let i = 1; i <= count; i++) {
        spaces.push({
          key: `${def.key}_${i}`,
          label: count > 1 ? `${def.label} ${i}` : def.label,
          icon: def.icon,
        });
      }
    }
  });

  // Amenities cochées (ancilliary / outside / cooking / etc.)
  const amenityLabels = Array.isArray(property?.amenityLabels) ? property.amenityLabels : [];
  AMENITY_SPACE_MAP.forEach((def) => {
    if (amenityLabels.some((l) => def.match.test(String(l).toLowerCase()))) {
      spaces.push({ key: `am_${def.label}`, label: def.label, icon: def.icon });
    }
  });

  // Champs booléens (grenier / garage / abri)
  BOOL_SPACE_MAP.forEach((def) => {
    if (property?.[def.field]) {
      spaces.push({ key: `bool_${def.field}`, label: def.label, icon: def.icon });
    }
  });

  return spaces;
};

// Espaces avec mesure de superficie renseignée (saisis dans la modale).
const buildMeasuredSpaces = (spaces) => {
  return (spaces || []).filter((s) => isFilled(s.surface));
};

// ─── Prestations du bien (Page 2 - bloc 3) ───
const PROPERTY_TYPE_TRANSLATIONS = {
  apartment: "Appartement",
  house: "Maison",
  castle: "Château",
  building: "Immeuble",
  farm: "Ferme",
  studio: "Studio",
  villa: "Villa",
  loft: "Loft",
  penthouse: "Penthouse",
  duplex: "Duplex",
  chalet: "Chalet",
  land: "Terrain",
};

const translatePropertyType = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return PROPERTY_TYPE_TRANSLATIONS[key] || String(value || "");
};

const buildPrestationsSection = (property) => {
  const items = [];

  if (isFilled(property?.type)) items.push({ icon: "Building2", label: "Type", value: translatePropertyType(property.type) });
  if (isFilled(property?.propertyFloor)) items.push({ icon: "Layers", label: "Étage", value: property.propertyFloor });
  if (isFilled(property?.totalFloorBuilding) && Number(property.totalFloorBuilding) > 0) items.push({ icon: "Building", label: "Étages de l'immeuble", value: property.totalFloorBuilding });
  if (isFilled(property?.building)) items.push({ icon: "CalendarClock", label: "Année de construction", value: property.building });
  if (isFilled(property?.situation)) items.push({ icon: "MapPin", label: "Situation", value: Array.isArray(property.situation) ? property.situation.join(", ") : property.situation });
  if (isFilled(property?.usedAs)) items.push({ icon: "Tag", label: "Usage", value: property.usedAs });

  const amenityLabels = Array.isArray(property?.amenityLabels) ? property.amenityLabels : [];
  const PRESTATION_ICONS = [
    { match: /parking|garage/i, icon: "Car" },
    { match: /balcon/i, icon: "Wind" },
    { match: /terrasse/i, icon: "Sunset" },
    { match: /jardin/i, icon: "Trees" },
    { match: /piscine/i, icon: "Waves" },
    { match: /ascenseur/i, icon: "ArrowUpDown" },
    { match: /s.curit/i, icon: "ShieldCheck" },
    { match: /interphone/i, icon: "Phone" },
    { match: /cave/i, icon: "Warehouse" },
    { match: /cuisine/i, icon: "ChefHat" },
    { match: /sport/i, icon: "Dumbbell" },
    { match: /gym/i, icon: "Dumbbell" },
    { match: /chauffage|gaz/i, icon: "Flame" },
    { match: /individuel/i, icon: "Flame" },
    { match: /collectif/i, icon: "Flame" },
  ];
  // Normalisation des libellés de prestations
  const normalizePrestation = (label) => {
    const l = String(label).trim();
    if (/^gaz$/i.test(l)) return "Chauffage gaz";
    if (/^individuel$/i.test(l)) return "Chauffage individuel";
    if (/^collectif$/i.test(l)) return "Chauffage collectif";
    return l;
  };
  amenityLabels.forEach((label) => {
    const found = PRESTATION_ICONS.find((p) => p.match.test(String(label).toLowerCase()));
    items.push({ icon: found ? found.icon : "Sparkles", label: normalizePrestation(label) });
  });

  if (isFilled(property?.energy_efficient)) items.push({ icon: "Zap", label: "DPE", value: property.energy_efficient });
  if (isFilled(property?.energyConsumption)) items.push({ icon: "PlugZap", label: "Consommation", value: `${property.energyConsumption} kWh/m²/an` });
  if (isFilled(property?.emission_efficient)) items.push({ icon: "Leaf", label: "GES", value: property.emission_efficient });

  return { items, visible: items.length > 0 };
};

// ─── Notations plateformes tierces (Page 5) ───
const buildExternalRatings = (property, revenueLabels) => {
  const ratings = [];
  (property?.rating || []).forEach((r) => {
    const typeId = r?.type;
    const platform = (revenueLabels && typeId && revenueLabels[String(typeId)]) || null;
    if (platform || isFilled(r?.rating_value)) {
      ratings.push({
        platform: platform || "Plateforme",
        rating: r?.rating_value || "",
      });
    }
  });
  return ratings;
};

// ─── 5 tableaux chiffrés (Page 5) ───
// `revenueLabels` : { ObjectIdString -> name } issu de revenueManagement, permet de
// résoudre les références (renovation_work.title, revenue_detail.type/source, etc.)
const resolveRefName = (id, revenueLabels, fallback) => {
  if (!id) return fallback || "";
  if (typeof id === "string" || typeof id === "object") {
    const key = String(id);
    if (revenueLabels && revenueLabels[key]) return revenueLabels[key];
  }
  // Si c'est déjà un objet peuplé { name, title, _id } on prend son libellé
  if (id && typeof id === "object" && (id.name || id.title || id.label)) {
    return id.name || id.title || id.label;
  }
  return fallback || "";
};

// Facture énergétique estimée (même calcul que le profil du bien).
const estimateEnergyBill = (surface, dpeClass) => {
  const pricePerKwh = 0.2516;
  const ranges = {
    A: { min: 0, max: 50 }, B: { min: 51, max: 90 }, C: { min: 91, max: 150 },
    D: { min: 151, max: 230 }, E: { min: 231, max: 330 }, F: { min: 331, max: 450 }, G: { min: 451, max: Infinity },
  };
  const cls = String(dpeClass || "").toUpperCase();
  const r = ranges[cls];
  const s = Number(surface) || 0;
  if (!r || s <= 0) return null;
  const min = Math.floor(r.min * s * pricePerKwh);
  const max = Math.floor(r.max * s * pricePerKwh);
  if (cls === "A") return `${formatCurrency(max)} / an (max)`;
  if (cls === "G") return `${formatCurrency(min)} / an (min)`;
  return `${formatCurrency(min)} - ${formatCurrency(max)} / an`;
};

// `priceOverride` : prix/loyer saisi dans la modale (biens en annuaire) ;
// sinon on retombe sur le prix du bien (backend).
const buildTablesSection = (property, destination, revenueLabels = {}, priceOverride) => {
  const tables = [];
  const displayPrice = priceOverride || (property?.price != null ? String(property.price) : "");

  const bien = [];
  if (isFilled(displayPrice)) bien.push({ label: destination === "rent" ? "Loyer" : "Prix de vente", value: formatCurrency(displayPrice) });
  if (isFilled(property?.propertyAgencyFees)) bien.push({ label: "Frais d'agence", value: formatCurrency(property.propertyAgencyFees) });
  if (isFilled(property?.propertyInventory)) bien.push({ label: "Frais de réalisation de l'état des lieux", value: formatCurrency(property.propertyInventory) });
  if (isFilled(property?.guaranteeDeposit)) bien.push({ label: "Montant de la caution", value: formatCurrency(property.guaranteeDeposit) });
  if (isFilled(property?.propertyCharges)) bien.push({ label: "Charges de copropriété", value: formatCurrency(property.propertyCharges) });
  if (isFilled(displayPrice)) bien.push({ label: "Estimation des frais de notaire", value: formatCurrency(Math.floor(Number(displayPrice) * 0.08)) });
  if (bien.length) tables.push({ key: "bien", title: "Le bien", rows: bien });

  const energie = [];
  const energyBill = estimateEnergyBill(property?.surface, property?.energy_efficient);
  if (energyBill) energie.push({ label: "Facture énergétique estimée", value: energyBill });
  if (isFilled(property?.energy_efficient)) energie.push({ label: "DPE", value: property.energy_efficient });
  if (isFilled(property?.energyConsumption)) energie.push({ label: "Consommation", value: property.energyConsumption + " kWh/m²/an" });
  if (isFilled(property?.emission_efficient)) energie.push({ label: "GES", value: property.emission_efficient });
  if (isFilled(property?.emissions)) energie.push({ label: "Émissions", value: property.emissions + " kg CO₂/m²/an" });
  if (isFilled(property?.heatingType?.title)) energie.push({ label: "Chauffage", value: property.heatingType.title });
  if (isFilled(property?.energymode?.title)) energie.push({ label: "Énergie", value: property.energymode.title });
  if (energie.length) tables.push({ key: "energie", title: "Énergie", rows: energie });

  if (destination !== "rent" && shouldShowCriticalSection(property?.revenue_detail)) {
    tables.push({
      key: "revenus",
      title: "Revenus",
      rows: property.revenue_detail.map((r) => {
        const typeName = resolveRefName(r?.type, revenueLabels, "");
        const year = r?.year ? `Année ${r.year}` : "Année —";
        const label = typeName ? `${year} — ${typeName}` : year;
        return { label, value: r?.price ? formatCurrency(r.price) : "" };
      }),
    });
  }

  if (shouldShowCriticalSection(property?.Expenses)) {
    tables.push({
      key: "depenses",
      title: "Dépenses courantes",
      rows: property.Expenses.map((e) => {
        const name = resolveRefName(e?.type, revenueLabels, "Dépense");
        const year = e?.year ? ` (${e.year})` : "";
        return { label: `${name}${year}`, value: e?.price ? formatCurrency(e.price) : "" };
      }),
    });
  }

  if (shouldShowCriticalSection(property?.renovation_work)) {
    tables.push({
      key: "travaux",
      title: "Travaux et rénovations",
      rows: property.renovation_work.map((w) => {
        const typeName = resolveRefName(w?.title, revenueLabels, "Travaux");
        const date = w?.renovationDate ? new Date(w.renovationDate).toLocaleDateString("fr-FR") : "";
        const parts = [typeName, w?.description, date].filter(Boolean);
        return { label: parts.join(" — "), value: w?.price ? formatCurrency(w.price) : "" };
      }),
    });
  }

  return { tables, visible: tables.length > 0 };
};

const buildSnapshot = (property, destination, selectedPhotos) => {
  return {
    cover: buildCoverSection(property),
    summary: buildSummarySection(property),
    media: buildMediaSection(property, selectedPhotos),
    environment: buildEnvironmentSection(property),
    keyFigures: buildKeyFiguresSection(property, destination),
    valueHistory: buildValueHistorySection(property, destination),
    engagement: buildEngagementSection(property),
    nextSteps: buildNextStepsSection(),
  };
};

module.exports = {
  buildSnapshot,
  isFilled,
  shouldShowSection,
  shouldShowCriticalSection,
  shouldShowEngagementBlock,
  formatCurrency,
  formatNumber,
  buildAvailableSpaces,
  buildMeasuredSpaces,
  buildPrestationsSection,
  translatePropertyType,
  buildExternalRatings,
  buildTablesSection,
};
