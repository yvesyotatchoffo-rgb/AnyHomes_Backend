const axios = require("axios");
const Logger = require("../utils/coachLogger");
const { LLM_ERROR_CODES, INTERACTION_TYPES } = require("../constants/llmErrorCodes");
const llmErrorTracker = require("./llmErrorTracker.service");

const logger = new Logger("ListingWritingService");

const PROMPT_VERSION = "v2.0";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "";
const NVIDIA_API_BASE = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";

const BLOCK_NAMES = {
  identity_hook: "Identité du bien",
  property_configuration: "Configuration",
  immediate_highlights: "Atouts immédiats",
  living_environment: "Cadre de vie",
  usage_comfort_performance: "Usage, confort et performance",
  target_positioning: "Positionnement cible",
  open_closure: "Le mot de la fin",
};

const BLOCK_ORDER = [
  "identity_hook",
  "property_configuration",
  "immediate_highlights",
  "living_environment",
  "usage_comfort_performance",
  "target_positioning",
  "open_closure",
];

const CIBLE_LABELS = {
  PrimoAccedant: "Primo-accédant : priorité à l'accessibilité, au coup de cœur accessible et aux aides.",
  Investisseur: "Investisseur : priorité au rendement, à la plus-value et à la demande locative.",
  ResidencePrincipale: "Résidence principale : priorité au cadre de vie, aux espaces et à la qualité quotidienne.",
  ResidenceSecondaire: "Résidence secondaire : priorité au dépaysement, au calme et aux loisirs.",
  Etudiant: "Étudiant : priorité à la proximité des transports, au prix et à la praticité.",
};

const AMBITION_LABELS = {
  Vente: "Vendre le bien : maximiser l'attractivité pour des acheteurs potentiels.",
  Location: "Louer le bien : rassurer les locataires, valoriser le confort et la localisation.",
  VenteFuture: "Préparer une vente future : positionner stratégiquement le bien sur le marché.",
  LocationFuture: "Préparer une location future : mettre en avant les atouts locatifs.",
  AcheteursPotentiels: "Identifier des acheteurs potentiels : susciter l'intérêt et les contacts.",
  Visibilite: "Accroître la visibilité du bien : description optimisée pour le référencement.",
  Valeur: "Accroître la valeur perçue : ton premium, mise en avant du cachet et des finitions.",
  TesterMarche: "Tester le marché : description neutre et factuelle pour jauger les réactions.",
  TesterPrix: "Tester un prix de vente : valoriser sans fixer d'attentes fermes.",
};

const SYSTEM_PROMPT = `Tu es un assistant de rédaction spécialisé dans la création de profils immobiliers durables pour AnyHomes.

Ta mission est de générer une description claire, structurée, professionnelle et naturelle d'un bien immobilier à partir des données fournies. Le contenu ne doit pas ressembler à une succession de champs, mais à un vrai profil de bien, lisible, rassurant et cohérent dans le temps.

AnyHomes n'est pas une plateforme d'annonces classiques : le bien y possède un profil permanent, comparable à une page de présentation professionnelle. Ta rédaction doit donc privilégier la lisibilité, la structure, la cohérence et la valeur informative plutôt qu'un style trop commercial ou trop promotionnel.

RÈGLES ESSENTIELLES :
- Respecte strictement la structure en 7 blocs définie ci-dessous.
- Garde toujours le même ordre des blocs.
- Chaque bloc doit commencer par son titre en gras.
- N'ajoute aucune donnée non fournie.
- Si une donnée est absente, ignore-la sans la remplacer par une supposition.
- Ne répète pas la même information dans plusieurs blocs.
- Utilise un ton professionnel, clair, humain et sobre.
- Évite les superlatifs excessifs, les formulations trop marketing et les clichés immobiliers.
- Adapte le vocabulaire à la cible et à l'ambition données.
- Le texte doit être lisible, stable et cohérent d'un profil de bien à l'autre.

STRUCTURE OBLIGATOIRE (7 blocs dans cet ordre) :
1. Identité du bien
2. Configuration
3. Atouts immédiats
4. Cadre de vie
5. Usage, confort et performance — Bloc le PLUS IMPORTANT : projette le lecteur dans la vie réelle dans le bien
6. Positionnement cible
7. Le mot de la fin

RÈGLE RENFORCÉE POUR LE BLOC 5 :
Le bloc 5 est le plus important. Il doit projeter le lecteur dans la vie réelle dans le bien et intégrer les éléments qui donnent une preuve de valeur ou d'usage : revenus, travaux, notes externes, performance énergétique, chauffage, confort, attractivité locative. Ne te contente jamais d'une liste. Explique toujours ce que ces éléments apportent.

POIDS DES DONNÉES PAR BLOC :
- Bloc 1 (Identité) : priorité à type, surface, city, rooms.
- Bloc 2 (Configuration) : priorité à rooms, bedrooms, bathroom, livingRoom, propertyFloor, situation, surface.
- Bloc 3 (Atouts) : priorité aux extérieurs (jardin, terrasse, balcon, garage), équipements (cuisine équipée, ascenseur, fibre).
- Bloc 4 (Cadre de vie) : priorité à state/quartier, environment (calme, animé), transports, commerces, écoles, leisure.
- Bloc 5 (Usage, confort, performance) : priorité à energy_efficient, heatingType, travaux, revenus, notes externes, equipment (fibre, ascenseur). C'est le bloc le plus riche.
- Bloc 6 (Positionnement cible) : priorité à l'adéquation entre les données du bien, l'ambition et la cible.
- Bloc 7 (Conclusion) : sobre et cohérente, sans appel à l'action agressif.

NOMBRE DE MOTS PAR BLOC (respecter ces fourchettes) :
- Bloc 1 (Identité du bien) : 25 à 45 mots
- Bloc 2 (Configuration) : 35 à 70 mots
- Bloc 3 (Atouts immédiats) : 35 à 70 mots
- Bloc 4 (Cadre de vie) : 35 à 70 mots
- Bloc 5 (Usage, confort et performance) : 70 à 140 mots ← LE PLUS LONG
- Bloc 6 (Positionnement cible) : 45 à 90 mots
- Bloc 7 (Le mot de la fin) : 20 à 40 mots`;

const buildGenerationContext = (cible, ambition) => {
  const cibleDesc = CIBLE_LABELS[cible] || "";
  const ambitionDesc = AMBITION_LABELS[ambition] || "";
  return {
    language: "fr",
    ambition: ambition || "Vente",
    target: cible || "ResidencePrincipale",
    tone: "professionnel",
    profile_style: "valorisant",
    editing_freedom: true,
    cible_label: cibleDesc,
    ambition_label: ambitionDesc,
  };
};

const buildPropertyContext = (data) => {
  const obj = {};

  if (data.type) obj.type = data.type;
  if (data.propertyType) obj.propertyType = data.propertyType;
  if (data.surface) obj.surface = Number(data.surface);
  if (data.landSurface) obj.landSurface = Number(data.landSurface);
  if (data.rooms) obj.rooms = Number(data.rooms);
  if (data.bedrooms) obj.bedrooms = Number(data.bedrooms);
  if (data.bathroom) obj.bathroom = Number(data.bathroom);
  if (data.toilets) obj.toilets = Number(data.toilets);
  if (data.livingRoom) obj.livingRoom = Number(data.livingRoom);
  if (data.propertyFloor !== undefined && data.propertyFloor !== null && data.propertyFloor !== "") {
    obj.propertyFloor = Number(data.propertyFloor);
    if (data.totalFloorBuilding) obj.totalFloorBuilding = Number(data.totalFloorBuilding);
  }
  if (data.building) obj.building = data.building;
  if (data.situation?.length) obj.situation = data.situation;
  if (data.address) obj.address = data.address;
  if (data.city) obj.city = data.city;
  if (data.state) obj.state = data.state;
  if (data.zipcode) obj.zipcode = data.zipcode;

  const amenityNames = [];
  for (const key of ["cooking", "equipment", "outside", "serviceAccessibility", "ancilliary", "environment", "leisure", "investment"]) {
    if (data[key]?.length) amenityNames.push(...data[key]);
  }
  if (amenityNames.length) {
    const names = amenityNames.filter((a) => typeof a === "string" && a.length > 0 && !a.match(/^[a-f0-9]{24}$/i));
    if (names.length) {
      const categorized = {};
      for (const key of ["cooking", "equipment", "outside", "serviceAccessibility", "ancilliary", "environment", "leisure", "investment"]) {
        if (data[key]?.length) {
          const catNames = data[key].filter((a) => typeof a === "string" && a.length > 0 && !a.match(/^[a-f0-9]{24}$/i));
          if (catNames.length) categorized[key] = catNames;
        }
      }
      obj.amenities = categorized;
    }
  }

  if (data.energy_efficient) obj.energy_efficient = data.energy_efficient;
  if (data.emission_efficient) obj.emission_efficient = data.emission_efficient;
  if (data.heatingType_efficient) obj.heatingType_efficient = data.heatingType_efficient;
  if (data.price) obj.price = Number(data.price);
  if (data.propertyMonthlyCharges) obj.propertyMonthlyCharges = Number(data.propertyMonthlyCharges);

  if (data.revenue_detail?.length) {
    obj.revenue_detail = data.revenue_detail.map((r) => {
      if (typeof r === "object") return { source: r.source || "", year: r.year || "", price: r.price ? Number(r.price) : 0 };
      return null;
    }).filter(Boolean);
  }
  if (data.renovation_work?.length) {
    obj.renovation_work = data.renovation_work.map((w) => {
      if (typeof w === "object") {
        return {
          description: w.description || w.title || "",
          price: w.price ? Number(w.price) : 0,
          year: w.renovationDate ? new Date(w.renovationDate).getFullYear() : null,
        };
      }
      return null;
    }).filter(Boolean);
  }
  if (data.rating?.length) {
    obj.rating = data.rating.map((r) => {
      if (typeof r === "object") return { type: r.type || "", rating_value: r.rating_value || "", url: r.url || "" };
      return null;
    }).filter(Boolean);
  }
  if (data.linkedSchools?.length) {
    obj.linkedSchools = data.linkedSchools.map((s) => {
      if (typeof s === "object") return { name: s.EstablishmentName || "", type: s.type || "" };
      return null;
    }).filter(Boolean);
  }

  return obj;
};

const buildUserPrompt = (propertyObj, ctx) => {
  const propertyJson = JSON.stringify(propertyObj, null, 2);
  const contextJson = JSON.stringify(ctx, null, 2);

  return `Génère un titre et une description pour ce bien immobilier.

DONNÉES DU BIEN :
${propertyJson}

CONTEXTE DE GÉNÉRATION :
${contextJson}

OUTPUT JSON ATTENDU (UNIQUEMENT ce JSON valide, rien d'autre) :
{
  "title": "Titre accrocheur (60-100 caractères) - NE PAS mettre ce texte dans description_blocks.identity_hook ni dans description_full",
  "description_blocks": {
    "identity_hook": "Bloc 1 - Identité du bien (1-2 phrases, NE PAS répéter le titre ici)",
    "property_configuration": "Bloc 2 - Configuration (1-3 phrases)",
    "immediate_highlights": "Bloc 3 - Atouts immédiats (1-3 phrases)",
    "living_environment": "Bloc 4 - Cadre de vie (1-3 phrases)",
    "usage_comfort_performance": "Bloc 5 - Usage, confort et performance (3-5 phrases)",
    "target_positioning": "Bloc 6 - Positionnement cible (2-4 phrases)",
    "open_closure": "Bloc 7 - Le mot de la fin (1 phrase)"
  },
  "description_full": "Description complète en HTML avec titres en <strong> et paragraphes en <p>",
  "generation_metadata": {
    "used_fields": ["champ1", "champ2"],
    "ignored_fields": [],
    "detected_angle": "Angle rédactionnel détecté",
    "missing_critical_fields": []
  }
}

RÈGLE ABSOLUE SUR LE TITLE :
1. Le champ "title" du JSON est le titre PRINCIPAL. Il est STRICTEMENT INTERDIT de le répéter dans identity_hook, description_full ou tout autre champ.
2. identity_hook est le premier paragraphe de la description, PAS le titre. Il commence directement par la description du bien.

RÈGLES DE NOMBRE DE MOTS PAR BLOC :
3. Bloc 1 (identity_hook) : 25 à 45 mots
4. Bloc 2 (property_configuration) : 35 à 70 mots
5. Bloc 3 (immediate_highlights) : 35 à 70 mots
6. Bloc 4 (living_environment) : 35 à 70 mots
7. Bloc 5 (usage_comfort_performance) : 70 à 140 mots
8. Bloc 6 (target_positioning) : 45 à 90 mots
9. Bloc 7 (open_closure) : 20 à 40 mots

RÈGLES DE FORMATAGE :
10. description_full en HTML valide : <strong>Titre du bloc</strong><p>Contenu...</p>
11. <strong> pour les 2-3 éléments saillants par bloc (revenus, travaux, notes, jardin, DPE).
12. N'invente aucune donnée absente. Le bloc 5 est le plus riche.`;
};

class ListingWritingService {
  async _callDeepSeek(systemPrompt, userPrompt) {
    if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not configured");
    const response = await axios.post(
      `${DEEPSEEK_API_BASE}/v1/chat/completions`,
      {
        model: DEEPSEEK_MODEL, temperature: 0.5, max_tokens: 1500,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      },
      { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    return response.data;
  }

  async _callNVIDIA(systemPrompt, userPrompt) {
    if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY not configured");
    const response = await axios.post(
      `${NVIDIA_API_BASE}/chat/completions`,
      {
        model: NVIDIA_MODEL, temperature: 0.7, max_tokens: 1500,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      },
      { headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" }, timeout: 60000 }
    );
    return response.data;
  }

  _parseResponse(responseData, provider) {
    let content = responseData.choices?.[0]?.message?.content || "";
    try { return JSON.parse(content); } catch (e) { logger.warn(`${provider} invalid JSON`, { error: e.message }); }

    let repaired = content.trim();
    if (repaired.startsWith("```")) {
      const nl = repaired.indexOf("\n");
      if (nl > 0) repaired = repaired.substring(nl + 1);
      const lt = repaired.lastIndexOf("```");
      if (lt > 0) repaired = repaired.substring(0, lt);
    }
    const js = repaired.indexOf("{");
    const je = repaired.lastIndexOf("}");
    if (js !== -1 && je > js) repaired = repaired.substring(js, je + 1);
    try { return JSON.parse(repaired); } catch (e2) { logger.error(`${provider} repair failed`, { content: content.slice(0, 300) }); return null; }
  }

  _buildDescriptionFull(blocks) {
    if (!blocks || typeof blocks !== "object") return "";
    return BLOCK_ORDER
      .map((key) => {
        const title = BLOCK_NAMES[key];
        const content = blocks[key] || "";
        if (!content) return "";
        return `**${title}**\n${content}`;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  async _resolveAmenities(data) {
    const amenityFields = ["cooking", "equipment", "outside", "serviceAccessibility", "ancilliary", "environment", "leisure", "investment"];
    const allIds = [];
    const fieldMap = {};
    for (const field of amenityFields) {
      if (Array.isArray(data[field])) {
        fieldMap[field] = [];
        for (const item of data[field]) {
          const id = typeof item === "object" ? (item._id || item.id) : item;
          if (id) { allIds.push(id); fieldMap[field].push(id); }
        }
      }
    }
    if (allIds.length === 0) return data;
    try {
      const Amenity = require("mongoose").model("amenities");
      const amenities = await Amenity.find({ _id: { $in: allIds } }).select("title _id").lean();
      const lookup = {};
      for (const a of amenities) lookup[a._id.toString()] = a.title || a.name || "";
      const resolved = { ...data };
      for (const field of amenityFields) {
        if (fieldMap[field]) resolved[field] = fieldMap[field].map((id) => lookup[id] || id).filter(Boolean);
      }
      return resolved;
    } catch (err) { logger.warn("Failed to resolve amenity names", { error: err.message }); return data; }
  }

  async generate({ propertyData, cible = "", ambition = "", userId, propertyId }) {
    const startTime = Date.now();
    const resolvedData = await this._resolveAmenities(propertyData);
    const propertyObj = buildPropertyContext(resolvedData);
    const ctx = buildGenerationContext(cible, ambition);
    const userPrompt = buildUserPrompt(propertyObj, ctx);

    const providers = [
      { name: "NVIDIA", call: () => this._callNVIDIA(SYSTEM_PROMPT, userPrompt) },
      { name: "DeepSeek", call: () => this._callDeepSeek(SYSTEM_PROMPT, userPrompt) },
    ];

    let responseData = null, usedProvider = "", lastError = null;
    for (const p of providers) {
      try {
        logger.info(`Trying ${p.name}`, { cible, ambition });
        responseData = await p.call();
        usedProvider = p.name;
        break;
      } catch (err) {
        const isBalance = err?.response?.status === 402;
        const errCode = p.name === "DeepSeek"
          ? (isBalance ? LLM_ERROR_CODES.DEEPSEEK_NO_BALANCE : LLM_ERROR_CODES.DEEPSEEK_API_ERROR)
          : LLM_ERROR_CODES.NVIDIA_API_ERROR;
        lastError = { code: errCode, provider: p.name, detail: err.message };
        logger.warn(`${p.name} failed`, { error: err.message });
      }
    }

    if (!responseData) {
      const ec = lastError?.code || LLM_ERROR_CODES.ALL_PROVIDERS_FAILED;
      llmErrorTracker.log({ userId, llmProvider: lastError?.provider || "unknown", interactionType: INTERACTION_TYPES.LISTING_WRITING, errorCode: ec.code, errorLabel: ec.label, errorDetail: lastError?.detail || "All providers failed", metadata: { cible, ambition } });
      return { success: false, error: "Le service de génération de contenu par l'IA est momentanément indisponible. Veuillez réessayer plus tard.", errorCode: ec.code };
    }

    const latencyMs = Date.now() - startTime;
    const parsed = this._parseResponse(responseData, usedProvider);

    if (!parsed) {
      const ec = LLM_ERROR_CODES.INVALID_RESPONSE;
      llmErrorTracker.log({ userId, llmProvider: usedProvider.toLowerCase(), interactionType: INTERACTION_TYPES.LISTING_WRITING, errorCode: ec.code, errorLabel: ec.label, errorDetail: `${usedProvider} unparseable`, metadata: { cible, ambition } });
      return { success: false, error: "Le service de génération de contenu par l'IA est momentanément indisponible. Veuillez réessayer plus tard.", errorCode: ec.code };
    }

    const blocks = parsed.description_blocks || {};
    let title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    if (!title && blocks.identity_hook) {
      const match = blocks.identity_hook.match(/^(.+?[.!?]+)\s*/);
      if (match) {
        title = match[1].trim();
        blocks.identity_hook = blocks.identity_hook.substring(match[0].length).trim();
      } else {
        title = blocks.identity_hook.substring(0, 100).trim();
        blocks.identity_hook = "";
      }
      if (title.length > 100) title = title.substring(0, 100).trim();
    }
    let descriptionFull = typeof parsed.description_full === "string" && parsed.description_full.trim()
      ? parsed.description_full.trim()
      : this._buildDescriptionFull(blocks);
    if (title && descriptionFull.startsWith(title)) {
      descriptionFull = descriptionFull.substring(title.length).replace(/^[\s,:\n]+/, "");
    }
    if (title && descriptionFull.startsWith(`**${title}**`)) {
      descriptionFull = descriptionFull.substring(`**${title}**`.length).replace(/^[\s,:\n]+/, "");
    }
    const meta = parsed.generation_metadata || {};

    const WORD_RANGES = {
      identity_hook: [25, 45], property_configuration: [35, 70], immediate_highlights: [35, 70],
      living_environment: [35, 70], usage_comfort_performance: [70, 140], target_positioning: [45, 90], open_closure: [20, 40],
    };
    for (const [key, [lo, hi]] of Object.entries(WORD_RANGES)) {
      const text = blocks[key] || "";
      const count = text.split(/\s+/).filter(Boolean).length;
      if ((count < lo || count > hi) && !meta.missing_critical_fields) meta.missing_critical_fields = [];
      if (count < lo) meta.missing_critical_fields.push(`Bloc "${BLOCK_NAMES[key]}" : ${count} mots (min ${lo} requis)`);
      if (count > hi) meta.missing_critical_fields.push(`Bloc "${BLOCK_NAMES[key]}" : ${count} mots (max ${hi} autorisé)`);
    }

    if (!title && !descriptionFull) {
      const ec = LLM_ERROR_CODES.EMPTY_CONTENT;
      llmErrorTracker.log({ userId, llmProvider: usedProvider.toLowerCase(), interactionType: INTERACTION_TYPES.LISTING_WRITING, errorCode: ec.code, errorLabel: ec.label, errorDetail: `${usedProvider} empty content`, metadata: { cible, ambition } });
      return { success: false, error: "Le service de génération de contenu par l'IA est momentanément indisponible. Veuillez réessayer plus tard.", errorCode: ec.code };
    }

    const result = {
      success: true,
      data: {
        title,
        description_blocks: blocks,
        description_full: descriptionFull,
        generation_metadata: meta,
        confidence: parsed.confidence || 0.85,
        cible,
        ambition,
      },
      meta: {
        provider: usedProvider,
        model_version: usedProvider === "DeepSeek" ? DEEPSEEK_MODEL : NVIDIA_MODEL,
        prompt_version: PROMPT_VERSION,
        cible, ambition,
        latency_ms: latencyMs,
      },
    };

    if (propertyId && userId) {
      this._saveVersion(propertyId, userId, result.data, cible, ambition, result.meta);
    }
    return result;
  }

  checkMissingFields(propertyData) {
    const KEY_FIELDS = [
      { field: "energy_efficient", label: "Classe énergie (DPE)", step: 5 },
      { field: "propertyFloor", label: "Étage", step: 4 },
      { field: "outside", label: "Extérieur (balcon, terrasse, jardin)", step: 4, isArray: true },
      { field: "equipment", label: "Équipements (parking, ascenseur)", step: 4, isArray: true },
      { field: "building", label: "Année de construction", step: 4 },
      { field: "landSurface", label: "Surface du terrain", step: 4 },
      { field: "situation", label: "Configuration (duplex, plain-pied)", step: 4, isArray: true },
      { field: "bedrooms", label: "Nombre de chambres", step: 4 },
    ];
    const missing = [];
    for (const kf of KEY_FIELDS) {
      const v = propertyData[kf.field];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "number" && v === 0);
      if (empty) missing.push(kf);
    }
    return missing;
  }

  async _saveVersion(propertyId, userId, data, cible, ambition, meta) {
    try {
      const model = require("mongoose").model("ListingWritingVersion");
      const version = new model({
        property_id: propertyId, user_id: userId,
        title: data.title, description: data.description_full || "",
        tone: cible, length: ambition, source: "llm",
        generation_data: {
          quality_flags: data.generation_metadata?.used_fields || [],
          missing_fields: data.generation_metadata?.missing_critical_fields || [],
          confidence: data.confidence,
          model_version: meta.model_version, prompt_version: meta.prompt_version,
          latency_ms: meta.latency_ms,
        },
        status: "draft",
      });
      await version.save();
    } catch (err) { logger.error("Save version failed", { error: err.message }); }
  }

  async getVersions(propertyId) {
    try {
      const model = require("mongoose").model("ListingWritingVersion");
      const versions = await model.find({ property_id: propertyId }).sort({ createdAt: -1 }).limit(20).lean();
      return { success: true, data: versions };
    } catch (err) { return { success: false, error: err.message }; }
  }
}

module.exports = new ListingWritingService();
