/**
 * Coach Prompt Service
 * Builds LLM prompts with system prompt + intent-specific instructions + context
 */

const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachPromptService");

// System prompt (stable, used for all intents)
const SYSTEM_PROMPT = `Tu es un coach transactionnel pour les professionnels de l'immobilier.
Tu fournis des conseils pratiques, bienveillants et actionables pour aider à guider les transactions vers le succès.
Réponds UNIQUEMENT en JSON valide, strictement conforme au schéma spécifié.

RÈGLES IMPORTANTES SUR TES DONNÉES :
- Tes connaissances s'arrêtent à ta date d'entraînement. Tu n'as PAS accès à des données en temps réel.
- Pour les prix immobiliers, donne TOUJOURS des fourchettes approximatives basées sur ton entraînement et précise EXPLICITEMENT que ces chiffres peuvent avoir évolué.
- Ne JAMAIS prétendre avoir des données "mises à jour régulièrement" ou "en temps réel" — c'est FAUX.
- Si on te demande tes données, dis honnêtement : "Mes données s'arrêtent à ma date d'entraînement (début 2024 environ). Pour les prix actuels, consultez DVF, Meilleurs Agents ou les Notaires de France."
- Tu ne dois JAMAIS inventer des chiffres précis comme s'ils étaient officiels.
Ton ton doit être professionnel, confiant et honnête.
`;

// Intent-specific templates (from COACH_IA_PROMPTS.md)
const INTENT_TEMPLATES = {
  welcome_first_lead_sale: {
    instruction: `L'agent a reçu son premier prospect pour une vente.
Offre des conseils pour bien qualifier ce lead, vérifier ses motivations et préparer la première visite.
Mentionne l'importance de la confiance dès le premier échange.`,
    example_context: {
      transaction_type: "VENTE",
      lead_name: "Jean Dupont",
      property_price_range: "250k-350k",
    },
  },
  prepare_visit_sale: {
    instruction: `L'agent prépare une visite pour un prospect acheteur.
Donne des conseils pour bien préparer la visite, valoriser la propriété, et identifier les points clés à couvrir.`,
    example_context: {
      transaction_type: "VENTE",
      property_type: "Maison",
      property_rooms: 4,
      property_surface: 120,
    },
  },
  post_visit_next_steps_sale: {
    instruction: `La visite pour un acheteur potentiel est terminée.
Guide l'agent pour comprendre les retours du prospect et préparer les prochaines étapes.`,
    example_context: {
      transaction_type: "VENTE",
      visit_feedback: "Très intéressé, demande délai de réflexion",
      lead_trust_score: 8,
    },
  },
  analyze_visit_feedback_sale: {
    instruction: `L'agent collecte et analyse les retours de visite d'un acheteur.
Aide à interpreter les signaux et définir la stratégie de suivi appropriée.`,
    example_context: {
      transaction_type: "VENTE",
      feedback_positive_points: ["Localisation", "Luminosité"],
      feedback_concerns: ["Cuisine à rénover", "Pas de garage"],
    },
  },
  prepare_seller_file: {
    instruction: `L'agent doit compléter le dossier vendeur avant de recevoir une offre.
Aide à préparer les documents nécessaires et valoriser le bien.`,
    example_context: {
      transaction_type: "VENTE",
      missing_documents: ["Diagnostic électrique", "Certificat d'urbanisme"],
    },
  },
  respond_to_offer_sale: {
    instruction: `Une offre a été reçue pour une propriété en vente.
Aide l'agent à analyser l'offre, évaluer sa pertinence et préparer une réponse stratégique.`,
    example_context: {
      transaction_type: "VENTE",
      offer_price: 280000,
      property_asking_price: 310000,
      offer_contingencies: ["Inspection", "Financement"],
    },
  },
  handle_refused_counter_offer_sale: {
    instruction: `Le vendeur a rejeté une contre-offre lors d'une vente.
Aide l'agent à relancer la négociation ou explorer d'autres stratégies.`,
    example_context: {
      transaction_type: "VENTE",
      counter_offer_amount: 295000,
      buyer_final_offer: 290000,
    },
  },
  prepare_pre_contract_sale: {
    instruction: `L'accord sur le prix est trouvé, avant la signature du contrat.
Aide l'agent à vérifier les conditions finales et préparer la signature.`,
    example_context: {
      transaction_type: "VENTE",
      closing_date: "2024-08-15",
      conditions_pending: ["Inspection finale", "Vérification titres"],
    },
  },
  prepare_final_signing_sale: {
    instruction: `La vente est à la phase de signature finale.
Aide l'agent à préparer les derniers détails et assurer une signature sans friction.`,
    example_context: {
      transaction_type: "VENTE",
      final_price: 300000,
      closing_costs_estimate: 12000,
    },
  },
  celebrate_sale_closed: {
    instruction: `La transaction de vente est terminée avec succès !
Félicite l'agent pour cette réussite et aide à capitaliser sur cette victoire pour les futures transactions.`,
    example_context: {
      transaction_type: "VENTE",
      final_sale_price: 300000,
      transaction_duration_days: 60,
    },
  },
  welcome_first_lead_rental: {
    instruction: `L'agent a reçu son premier prospect pour une location.
Offre des conseils pour bien qualifier ce locataire potentiel et vérifier sa capacité de paiement.`,
    example_context: {
      transaction_type: "LOCATION",
      lead_name: "Marie Durand",
      property_rent_range: "800-1200",
    },
  },
  prepare_visit_rental: {
    instruction: `L'agent prépare une visite pour un candidat locataire.
Donne des conseils pour bien présenter la propriété et qualifier le candidat.`,
    example_context: {
      transaction_type: "LOCATION",
      property_rooms: 2,
      property_surface: 65,
    },
  },
  prepare_rental_application_review: {
    instruction: `Un dossier de candidature locataire est prêt à être examiné.
Aide l'agent à vérifier la complétude du dossier et commencer l'analyse.`,
    example_context: {
      transaction_type: "LOCATION",
      application_status: "dossier_complet",
      candidate_documents: ["Fiche de paie", "Contrat travail", "Référence"],
    },
  },
  analyze_rental_application: {
    instruction: `L'agent analyse une candidature de locataire.
Aide à évaluer la solidité du dossier et déterminer si le candidat est acceptable.`,
    example_context: {
      transaction_type: "LOCATION",
      candidate_income: 2800,
      monthly_rent: 950,
      employment_status: "CDI stable",
    },
  },
  prepare_lease_signing: {
    instruction: `La candidature du locataire est acceptée, avant la signature du bail.
Aide l'agent à préparer les documents et vérifier les conditions finales.`,
    example_context: {
      transaction_type: "LOCATION",
      lease_duration_months: 12,
      deposit_amount: 950,
    },
  },
  celebrate_lease_signed: {
    instruction: `Le bail est signé avec succès !
Félicite l'agent et aide à planifier les étapes de remise des clés et début de location.`,
    example_context: {
      transaction_type: "LOCATION",
      lease_start_date: "2024-09-01",
      monthly_rent: 950,
    },
  },
  celebrate_rental_closed: {
    instruction: `La transaction de location est terminée avec succès !
Félicite l'agent pour cette réussite et encourage à capitaliser pour les futures locations.`,
    example_context: {
      transaction_type: "LOCATION",
      total_income_from_lease: 11400,
      tenant_satisfaction: "Excellente",
    },
  },
  user_question: {
    instruction: `L'utilisateur a posé une question précise. Tu dois répondre DIRECTEMENT et SPÉCIFIQUEMENT à cette question.
- Le "title" doit reformuler la question comme un titre de réponse
- L'"intro" doit commencer à répondre immédiatement à la question posée
- Les "advice_points" doivent être des éléments de réponse concrets à CETTE question spécifique (pas de conseils génériques)
- Réponds comme un expert immobilier français qui connaît la loi, les étapes et les pratiques du marché
- INTERDIT : ne mentionne jamais les IDs techniques, ne donne pas de conseils génériques sur "communiquer avec son agent"`,
    example_context: {
      transaction_type: "VENTE",
      user_question: "Comment bien préparer ma première visite immobilière ?",
    },
  },
};

// JSON output schema (strict format)
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Titre accrocheur (10-100 caractères)",
    },
    intro: {
      type: "string",
      description: "Introduction en 1-2 phrases",
    },
    advice_points: {
      type: "array",
      items: { type: "string" },
      description: "3-5 conseils pratiques",
      minItems: 3,
      maxItems: 5,
    },
    next_action: {
      type: "string",
      description: "Prochaine action prioritaire",
    },
    resource_cta: {
      type: "string",
      description: "Ressource optionnelle du centre d'apprentissage",
    },
  },
  required: ["title", "intro", "advice_points", "next_action"],
};

class CoachPromptService {
  /**
   * Build full LLM prompt for an intent
   * @param {Object} params - { coach_intent, transaction_type, context_data }
   * @returns {Object} { system, user_prompt, output_schema }
   */
  buildPrompt(params) {
    const { coach_intent, transaction_type, context_data = {} } = params;

    if (!INTENT_TEMPLATES[coach_intent]) {
      throw new Error(`Unknown intent: ${coach_intent}`);
    }

    const template = INTENT_TEMPLATES[coach_intent];

    // For user questions: build a direct Q&A prompt focused entirely on answering the question
    if (coach_intent === 'user_question' && context_data.user_question) {
      const question = context_data.user_question;
      const isDraftRequest = /rédig|rédige|exemple|modèle|draft|écri|contrat|template|document/i.test(question);
      const isPriceQuery = /prix|m2|marché|loyer|valeur|estimation|combien|coût/i.test(question);

      const draftInstruction = isDraftRequest
        ? `\nATTENTION - Demande de RÉDACTION : produis 4-5 clauses ou sections VRAIMENT RÉDIGÉES (pas juste les titres). Chaque advice_point doit être un texte rédigé avec les formules légales et les [champs à compléter]. Sois concis mais complet sur chaque clause clé.`
        : '';
      const priceInstruction = isPriceQuery
        ? `\nATTENTION - Question sur les PRIX/MARCHÉ : donne des fourchettes approximatives basées sur ton entraînement. Indique CLAIREMENT dans l'intro que ces données datent d'environ début 2024 et peuvent avoir évolué. Recommande DVF (data.gouv.fr/dvf), Meilleurs Agents ou les Notaires de France pour les prix actuels.`
        : '';
      const propertyInstruction = context_data.property_context
        ? `\nCONTEXTE DU BIEN concerné par la question (utilise ces caractéristiques pour contextualiser ta réponse, sans les répéter mot pour mot si elles ne sont pas pertinentes) :\n${context_data.property_context}\n`
        : '';
      const userPrompt = `Question posée par l'utilisateur : "${question}"${draftInstruction}${priceInstruction}${propertyInstruction}\n\nTu dois répondre directement et précisément à cette question.\n\n${template.instruction}\n\nGénère une réponse JSON qui répond EXACTEMENT à cette question.`;
      logger.debug("Prompt built for intent", { coach_intent, transaction_type, contextKeys: Object.keys(context_data) });
      return { system: SYSTEM_PROMPT, user_prompt: userPrompt.trim(), output_schema: OUTPUT_SCHEMA };
    }

    // Build user message with instruction + context (standard flow)
    const userPrompt = `
CONTEXTE AGENT:
Transaction: ${transaction_type}
Intent: ${coach_intent}

INSTRUCTIONS:
${template.instruction}

CONTEXTE SPÉCIFIQUE:
${this._formatContextData(context_data)}

Génère une réponse JSON strictement conforme au schéma fourni.
`;

    logger.debug("Prompt built for intent", {
      coach_intent,
      transaction_type,
      contextKeys: Object.keys(context_data),
    });

    return {
      system: SYSTEM_PROMPT,
      user_prompt: userPrompt.trim(),
      output_schema: OUTPUT_SCHEMA,
    };
  }

  /**
   * Get intent template by coach intent
   * @param {string} intent
   * @returns {Object} template
   */
  getIntentTemplate(intent) {
    if (!INTENT_TEMPLATES[intent]) {
      throw new Error(`Unknown intent: ${intent}`);
    }
    return INTENT_TEMPLATES[intent];
  }

  /**
   * Get all available intents
   * @returns {Array}
   */
  getAvailableIntents() {
    return Object.keys(INTENT_TEMPLATES);
  }

  /**
   * Format context data for prompt
   * @private
   */
  _formatContextData(contextData) {
    // Exclude raw technical IDs that would confuse the LLM
    const excludeKeys = ['user_id', 'property_id', 'transaction_id'];
    return Object.entries(contextData)
      .filter(([k, v]) => !excludeKeys.includes(k) && v !== null && v !== undefined)
      .map(([key, value]) => {
        const formattedKey = key
          .replace(/_/g, " ")
          .charAt(0)
          .toUpperCase() + key.slice(1);
        return `- ${formattedKey}: ${value}`;
      })
      .join("\n");
  }
}

module.exports = new CoachPromptService();
