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
};
