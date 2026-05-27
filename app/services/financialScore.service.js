const db = require("../models");

const DEFAULTS = {
  debtRatio: 0.35,
  loanDurationYears: 25,
  nominalAnnualRate: 0.035,
  insuranceAnnualRate: 0.01,
  grossToNetCoefficient: 0.75,
  variableIncomeRetention: 0.7,
  additionalIncomeRetention: 0.7,
  feesRate: {
    ancien: 0.08,
    neuf: 0.03,
    "vente sur plan": 0.03,
    construction: 0.1,
    "terrain + construction": 0.1,
  },
  scoreBuckets: [
    { min: 1.1, score: 70 },
    { min: 1.0, score: 60 },
    { min: 0.9, score: 48 },
    { min: 0.8, score: 35 },
    { min: 0.7, score: 22 },
    { min: 0.6, score: 12 },
    { min: 0.0, score: 0 },
  ],
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const num = Number(String(value).replace(/[^0-9\.,-]/g, "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

const clamp = (value, min, max) => {
  if (Number.isNaN(value) || value === undefined || value === null) return min;
  return Math.max(min, Math.min(max, value));
};

const normalizeFeesRate = (feesRate = {}) => ({
  ancien: feesRate.ancien ?? feesRate["ancien"] ?? DEFAULTS.feesRate.ancien,
  neuf: feesRate.neuf ?? feesRate["neuf"] ?? DEFAULTS.feesRate.neuf,
  "vente sur plan": feesRate["vente sur plan"] ?? feesRate.venteSurPlan ?? DEFAULTS.feesRate["vente sur plan"],
  construction: feesRate.construction ?? feesRate["construction"] ?? DEFAULTS.feesRate.construction,
  "terrain + construction": feesRate["terrain + construction"] ?? feesRate.terrainConstruction ?? DEFAULTS.feesRate["terrain + construction"],
});

const loadScoreParameters = async () => {
  try {
    const settings = await db.scoreParameters.findOne({ status: "active" }).lean();
    if (!settings) return DEFAULTS;

    return {
      debtRatio: settings.debtRatio ?? DEFAULTS.debtRatio,
      loanDurationYears: settings.loanDurationYears ?? DEFAULTS.loanDurationYears,
      nominalAnnualRate: settings.nominalAnnualRate ?? DEFAULTS.nominalAnnualRate,
      insuranceAnnualRate: settings.insuranceAnnualRate ?? DEFAULTS.insuranceAnnualRate,
      grossToNetCoefficient: settings.grossToNetCoefficient ?? DEFAULTS.grossToNetCoefficient,
      variableIncomeRetention: settings.variableIncomeRetention ?? DEFAULTS.variableIncomeRetention,
      additionalIncomeRetention: settings.additionalIncomeRetention ?? DEFAULTS.additionalIncomeRetention,
      feesRate: normalizeFeesRate(settings.feesRate),
      scoreBuckets: Array.isArray(settings.scoreBuckets) && settings.scoreBuckets.length > 0
        ? [...settings.scoreBuckets]
            .map((bucket) => ({
              min: Number(bucket.min) || 0,
              score: Number(bucket.score) || 0,
            }))
            .sort((a, b) => b.min - a.min)
        : DEFAULTS.scoreBuckets,
    };
  } catch (err) {
    return DEFAULTS;
  }
};

const getAnnualizedNetSalary = (salaryType, salaryAmount, params) => {
  const amount = parseNumber(salaryAmount);
  if (amount <= 0 || !salaryType) return 0;
  const type = String(salaryType).trim().toLowerCase();
  if (type === "mensuel net avant impôts") {
    return amount;
  }
  if (type === "annuel net avant impots" || type === "annuel net avant impôts") {
    return amount / 12;
  }
  if (type === "mensuel brut") {
    return amount * params.grossToNetCoefficient;
  }
  if (type === "annuel brut") {
    return (amount * params.grossToNetCoefficient) / 12;
  }
  return 0;
};

const getMonthlyPrimes = (bonusReceived, bonusType, bonusAmount, params) => {
  if (String(bonusReceived).trim() !== "percevez des primes") return 0;
  const amount = parseNumber(bonusAmount);
  if (amount <= 0) return 0;
  const type = String(bonusType || "mensuel net avant impôts").trim().toLowerCase();
  if (type === "mensuel net avant impôts") {
    return amount * params.variableIncomeRetention;
  }
  if (type === "annuel net avant impots" || type === "annuel net avant impôts") {
    return (amount / 12) * params.variableIncomeRetention;
  }
  if (type === "mensuel brut") {
    return amount * params.grossToNetCoefficient * params.variableIncomeRetention;
  }
  if (type === "annuel brut") {
    return (amount * params.grossToNetCoefficient / 12) * params.variableIncomeRetention;
  }
  return 0;
};

const getMonthlyAdditionalIncome = (additionalIncome, additionalIncomeAmount, params) => {
  if (String(additionalIncome).trim() !== "percevez des") return 0;
  const amount = parseNumber(additionalIncomeAmount);
  if (amount <= 0) return 0;
  return amount * params.additionalIncomeRetention;
};

const getCreditMonthlyTotal = (declarativeBuyerFiles) => {
  let total = 0;
  const entries = Array.isArray(declarativeBuyerFiles.creditEntries)
    ? declarativeBuyerFiles.creditEntries
    : [];
  entries.forEach((entry) => {
    total += parseNumber(entry?.creditMonthlyAmount);
  });
  if (total > 0) {
    return total;
  }
  if (String(declarativeBuyerFiles.creditSituation).trim() === "remboursez un crédit") {
    total += parseNumber(declarativeBuyerFiles.creditMonthlyAmount);
  }
  return total;
};

const getAlimonyTotal = (declarativeBuyerFiles) => {
  const payer = parseNumber(declarativeBuyerFiles.alimonyAmount);
  const spouse = parseNumber(declarativeBuyerFiles.spouseAlimonyAmount);
  return payer + spouse;
};

const getProjectFeeRate = (propertyType, declaredPropertyType, feesRate) => {
  const type = String(declaredPropertyType || propertyType || "").trim().toLowerCase();
  if (type === "neuf") return feesRate.neuf;
  if (type === "vente sur plan") return feesRate["vente sur plan"] ?? feesRate.neuf;
  if (type === "construction") return feesRate.construction;
  if (type === "terrain + construction") return feesRate["terrain + construction"] ?? feesRate.construction;
  return feesRate.ancien;
};

const computeMonthlyPaymentForAmount = (amount, monthlyRate, durationMonths) => {
  if (amount <= 0 || durationMonths <= 0) return 0;
  if (monthlyRate > 0) {
    return amount * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -durationMonths)));
  }
  return amount / durationMonths;
};

const computeLoanAmountFromMonthlyPayment = (monthlyPayment, monthlyRate, durationMonths) => {
  if (monthlyPayment <= 0 || durationMonths <= 0) return 0;
  if (monthlyRate > 0) {
    return monthlyPayment * ((1 - Math.pow(1 + monthlyRate, -durationMonths)) / monthlyRate);
  }
  return monthlyPayment * durationMonths;
};

const getScoreQuantitative = (ratio, scoreBuckets) => {
  for (const bucket of scoreBuckets) {
    if (ratio >= bucket.min) return bucket.score;
  }
  return 0;
};

const getProfessionalStabilityScore = (employmentCategory, employmentContract, probationStatus) => {
  const category = String(employmentCategory || "").trim();
  if (category === "Salarié") {
    const contract = String(employmentContract || "").trim();
    const probation = String(probationStatus || "").trim();
    if (contract === "CDI" && probation !== "période d'essai") return 10;
    if (contract === "CDI" && probation === "période d'essai") return 5;
    if (contract === "CDD") return 4;
    return 5;
  }
  if (category === "Indépendant") return 5;
  if (category === "Retraité") return 7;
  if (category === "Etudiant") return 1;
  if (category === "Sans emploi") return 0;
  return 3;
};

const getApportScore = (apport, projectCost) => {
  if (projectCost <= 0) return 0;
  const ratio = apport / projectCost;
  if (ratio >= 0.2) return 8;
  if (ratio >= 0.1) return 6;
  if (ratio >= 0.05) return 3;
  return 0;
};

const getResidualSavingsScore = (remainingSavings, mensualiteCible) => {
  if (mensualiteCible <= 0) {
    return remainingSavings > 0 ? 5 : 0;
  }
  const ratio = remainingSavings / mensualiteCible;
  if (ratio >= 6) return 5;
  if (ratio >= 3) return 3;
  if (ratio > 0) return 1;
  return 0;
};

const getHouseholdStructureScore = (buyOption, numberChildren) => {
  let score = 0;
  const option = String(buyOption || "").trim();
  if (option === "à deux") score = 4;
  else if (option === "seul") score = 2;
  else if (option === "en SCI") score = 2;
  else score = 2;
  if (Number(numberChildren) === 3) score -= 1;
  if (Number(numberChildren) >= 4) score -= 2;
  return clamp(score, 0, 4);
};

const getResidenceScore = (housingSituation) => {
  const situation = String(housingSituation || "").toLowerCase();
  if (situation.includes("locataire") || situation.includes("propriétaire")) return 3;
  if (situation.includes("hébergé")) return 1;
  if (situation.includes("fonction")) return 1;
  return 1;
};

const classifyScore = (score) => {
  if (score >= 85) return { scoreClass: "TRES_FORTE", scoreLabel: "Très forte crédibilité" };
  if (score >= 70) return { scoreClass: "FORTE", scoreLabel: "Forte crédibilité" };
  if (score >= 55) return { scoreClass: "INTERMEDIAIRE", scoreLabel: "Crédibilité intermédiaire" };
  if (score >= 40) return { scoreClass: "FRAGILE", scoreLabel: "Crédibilité fragile" };
  return { scoreClass: "FAIBLE", scoreLabel: "Crédibilité faible" };
};

const buildTopReasons = ({
  priceSource,
  ratioFinancabilite,
  apportRatio,
  remainingSavings,
  mensualiteCible,
  creditMonthlyTotal,
  professionalScore,
  hasFallbackPrice,
  hasPropertyPrice,
}) => {
  const reasons = [];
  if (priceSource === "PROPERTY_REFERENCE_ZIPCODE_M2") {
    reasons.push("Le prix du bien a été estimé à partir du prix de référence au m² du code postal.");
  }
  if (ratioFinancabilite >= 1) {
    reasons.push("La capacité d’emprunt théorique est supérieure au besoin de financement estimé pour ce projet.");
  } else if (ratioFinancabilite >= 0.9) {
    reasons.push("La capacité d’emprunt théorique est proche du besoin estimé.");
  } else {
    reasons.push("Le besoin de financement estimé reste élevé par rapport aux revenus retenus.");
  }
  if (apportRatio >= 0.2) {
    reasons.push("Le projet est soutenu par un apport significatif.");
  }
  if (remainingSavings > 0 && mensualiteCible > 0 && remainingSavings / mensualiteCible >= 3) {
    reasons.push("L’épargne résiduelle améliore la solidité du dossier.");
  }
  if (creditMonthlyTotal > 0) {
    reasons.push("Les crédits en cours réduisent la mensualité disponible.");
  }
  if (professionalScore >= 7) {
    reasons.push("La stabilité professionnelle améliore la crédibilité financière du dossier.");
  }
  if (reasons.length > 3) return reasons.slice(0, 3);
  return reasons;
};

const normalizePropertySurface = (property) => {
  const surface = parseNumber(property?.surface || property?.area || property?.livingArea || 0);
  return surface;
};

const loadReferencePrice = async (postalCode) => {
  if (!postalCode) return null;
  const ref = await db.campaignRefPrice.findOne({ postalCode: String(postalCode).trim() });
  return ref?.refPrice ? parseNumber(ref.refPrice) : null;
};

const computeFinancialScore = async ({
  declarativeBuyerFiles = {},
  property = null,
}) => {
  const params = await loadScoreParameters();
  const questionnaire = declarativeBuyerFiles || {};
  const mode = property ? "PROPERTY_MATCH" : "QUESTIONNAIRE_ONLY";
  const salary = getAnnualizedNetSalary(questionnaire.salaryType, questionnaire.salaryAmount, params);
  const primes = getMonthlyPrimes(questionnaire.bonusReceived, questionnaire.bonusType, questionnaire.bonusAmount, params);
  const additionalIncome = getMonthlyAdditionalIncome(questionnaire.additionalIncome, questionnaire.additionalIncomeAmount, params);
  const creditMonthlyTotal = getCreditMonthlyTotal(questionnaire);
  const alimonyTotal = getAlimonyTotal(questionnaire);
  const charges = creditMonthlyTotal + alimonyTotal;
  const apport = parseNumber(questionnaire.ownContribution);
  const remainingSavings = parseNumber(questionnaire.remainingSavings);
  const priceTarget = parseNumber(questionnaire.purchasePrice);

  let priceSource = "QUESTIONNAIRE";
  let priceReferenceProjet = priceTarget;
  let referencePricePerSqm = 0;
  let referencePricePostalCode = "";
  let surfaceUsedForReference = 0;
  let hasFallbackPrice = false;
  let hasPropertyPrice = false;

  if (mode === "PROPERTY_MATCH") {
    const propertyPrice = parseNumber(property.price);
    const surface = normalizePropertySurface(property);
    const zipcode = String(property.zipcode || "").trim();

    if (propertyPrice > 0) {
      priceReferenceProjet = propertyPrice;
      priceSource = "PROPERTY";
      hasPropertyPrice = true;
    } else {
      const refPrice = await loadReferencePrice(zipcode);
      if (surface > 0 && refPrice > 0) {
        priceReferenceProjet = Math.round(surface * refPrice);
        priceSource = "PROPERTY_REFERENCE_ZIPCODE_M2";
        referencePricePerSqm = refPrice;
        referencePricePostalCode = zipcode;
        surfaceUsedForReference = surface;
        hasFallbackPrice = true;
      } else {
        return {
          mode,
          price_source: null,
          price_reference_projet: 0,
          reference_price_per_sqm: refPrice || 0,
          reference_price_postal_code: zipcode,
          surface_used_for_reference: surface,
          score: 0,
          score_class: "",
          score_label: "",
          score_status: "INSUFFICIENT_PROPERTY_DATA",
          ratio_financabilite: 0,
          capital_empruntable: 0,
          besoin_financement: 0,
          mensualite_disponible: 0,
          score_quantitatif: 0,
          score_qualitatif: 0,
          top_reasons: ["Les données du bien sont insuffisantes pour calculer le score."],
        };
      }
    }
  } else {
    if (priceTarget <= 0) {
      return {
        mode,
        price_source: null,
        price_reference_projet: 0,
        reference_price_per_sqm: 0,
        reference_price_postal_code: "",
        surface_used_for_reference: 0,
        score: 0,
        score_class: "",
        score_label: "",
        score_status: "INSUFFICIENT_DATA",
        ratio_financabilite: 0,
        capital_empruntable: 0,
        besoin_financement: 0,
        mensualite_disponible: 0,
        score_quantitatif: 0,
        score_qualitatif: 0,
        top_reasons: ["Le prix déclaré dans le questionnaire est manquant ou invalide."],
      };
    }
  }

  const realSalary = salary;
  if (realSalary <= 0) {
    return {
      mode,
      price_source: priceSource,
      price_reference_projet: priceReferenceProjet,
      reference_price_per_sqm: referencePricePerSqm,
      reference_price_postal_code: referencePricePostalCode,
      surface_used_for_reference: surfaceUsedForReference,
      score: 0,
      score_class: "",
      score_label: "",
      score_status: "INSUFFICIENT_DATA",
      ratio_financabilite: 0,
      capital_empruntable: 0,
      besoin_financement: 0,
      mensualite_disponible: 0,
      score_quantitatif: 0,
      score_qualitatif: 0,
      top_reasons: ["Les revenus déclarés sont insuffisants pour calculer la crédibilité financière."],
    };
  }

  const revenueRetenu = realSalary + primes + additionalIncome;
  const fraisRate = getProjectFeeRate(questionnaire.propertyType, questionnaire.propertyType, params.feesRate);
  const fraisEstimes = Math.round(priceReferenceProjet * fraisRate);
  const coutProjet = priceReferenceProjet + fraisEstimes;
  const besoinFinancement = Math.max(0, coutProjet - apport);
  const capaciteBrute = revenueRetenu * params.debtRatio;
  const mensualiteDisponible = Math.max(0, capaciteBrute - charges);
  const monthlyRate = (params.nominalAnnualRate + params.insuranceAnnualRate) / 12;
  const durationMonths = params.loanDurationYears * 12;
  const capitalEmpruntable = mensualiteDisponible > 0 ? computeLoanAmountFromMonthlyPayment(mensualiteDisponible, monthlyRate, durationMonths) : 0;
  const ratioFinancabilite = besoinFinancement === 0 ? 1.2 : clamp(capitalEmpruntable / besoinFinancement, 0, 1.2);
  const scoreQuantitative = getScoreQuantitative(ratioFinancabilite, params.scoreBuckets);
  const monthlyTarget = computeMonthlyPaymentForAmount(besoinFinancement, monthlyRate, durationMonths);
  const stabilityScore = getProfessionalStabilityScore(questionnaire.employmentCategory, questionnaire.employmentContract, questionnaire.probationStatus);
  const apportScore = getApportScore(apport, coutProjet);
  const epargneScore = getResidualSavingsScore(remainingSavings, monthlyTarget);
  const structureScore = getHouseholdStructureScore(questionnaire.BuyOption, questionnaire.numberChildren);
  const residenceScore = getResidenceScore(questionnaire.housingSituation);
  const scoreQualitative = clamp(stabilityScore + apportScore + epargneScore + structureScore + residenceScore, 0, 30);
  const score = clamp(Math.round(scoreQuantitative + scoreQualitative), 0, 100);
  const { scoreClass, scoreLabel } = classifyScore(score);
  const topReasons = buildTopReasons({
    priceSource,
    ratioFinancabilite,
    apportRatio: apport / (coutProjet || 1),
    remainingSavings,
    mensualiteCible: monthlyTarget,
    creditMonthlyTotal,
    professionalScore: stabilityScore,
    hasFallbackPrice,
    hasPropertyPrice,
  });

  return {
    mode,
    price_source: priceSource,
    price_reference_projet: priceReferenceProjet,
    reference_price_per_sqm: referencePricePerSqm,
    reference_price_postal_code: referencePricePostalCode,
    surface_used_for_reference: surfaceUsedForReference,
    score,
    score_class: scoreClass,
    score_label: scoreLabel,
    score_status: "OK",
    ratio_financabilite: Number(ratioFinancabilite.toFixed(2)),
    capital_empruntable: Math.round(capitalEmpruntable),
    besoin_financement: Math.round(besoinFinancement),
    mensualite_disponible: Math.round(mensualiteDisponible),
    score_quantitatif: scoreQuantitative,
    score_qualitatif: scoreQualitative,
    top_reasons: topReasons,
  };
};

module.exports = {
  computeFinancialScore,
  loadScoreParameters,
};
