/**
 * Coach Controller
 * REST endpoint handlers for Coach IA API
 */

const coachService = require("../services/coach.service");
const coachTriggerService = require("../services/coachTrigger.service");
const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachController");

class CoachController {
  /**
   * POST /api/coach/events/ingest
   * Ingest an event and start processing pipeline
   */
  async ingestEvent(req, res) {
    try {
      const { event_id, user_id, property_id, transaction_id, trigger_ref, payload_json } =
        req.body;

      // Validate required fields
      if (!event_id || !user_id || !property_id || !trigger_ref) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: event_id, user_id, property_id, trigger_ref",
        });
      }

      // Ingest event
      const request = await coachService.ingestEvent({
        event_id,
        user_id,
        property_id,
        transaction_id,
        trigger_ref,
        payload_json,
      });

      res.status(201).json({
        success: true,
        request_id: request._id,
        event_id: request.event_id,
        status: request.status,
      });
    } catch (error) {
      logger.error("ingestEvent failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to ingest event",
      });
    }
  }

  /**
   * POST /api/coach/messages/plan
   * Plan a message (deduplication check)
   */
  async planMessage(req, res) {
    try {
      const { request_id } = req.body;

      if (!request_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: request_id",
        });
      }

      const request = await coachService.planMessage(request_id);

      res.json({
        success: true,
        request_id: request._id,
        status: request.status,
      });
    } catch (error) {
      logger.error("planMessage failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to plan message",
      });
    }
  }

  /**
   * POST /api/coach/messages/generate
   * Generate message content via LLM
   */
  async generateMessage(req, res) {
    try {
      const { request_id, context_data } = req.body;

      if (!request_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: request_id",
        });
      }

      const record = await coachService.generateMessage(request_id, context_data || {});

      res.status(201).json({
        success: true,
        record_id: record._id,
        status: record.status,
        message: record.output_json,
        metrics: {
          latency_ms: record.llm_latency_ms,
          token_input: record.token_input,
          token_output: record.token_output,
          cost_usd: record.estimated_cost_usd,
        },
      });
    } catch (error) {
      logger.error("generateMessage failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to generate message",
      });
    }
  }

  /**
   * POST /api/coach/messages/validate
   * Validate and repair message if needed
   */
  async validateMessage(req, res) {
    try {
      const { record_id } = req.body;

      if (!record_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: record_id",
        });
      }

      const record = await coachService.validateMessage(record_id);

      res.json({
        success: true,
        record_id: record._id,
        validation_result: record.validation_result,
        status: record.status,
      });
    } catch (error) {
      logger.error("validateMessage failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to validate message",
      });
    }
  }

  /**
   * POST /api/coach/messages/send
   * Send message (mark as sent, record in history)
   */
  async sendMessage(req, res) {
    try {
      const { record_id, channel } = req.body;

      if (!record_id) {
        return res.status(400).json({
          success: false,
          error: "Missing required field: record_id",
        });
      }

      const record = await coachService.sendMessage(record_id, channel || "polling");

      res.json({
        success: true,
        record_id: record._id,
        status: record.status,
        sent_at: record.sent_at,
      });
    } catch (error) {
      logger.error("sendMessage failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      });
    }
  }

  /**
   * GET /api/coach/messages/history/:user_id
   * Get message history for user
   */
  async getMessageHistory(req, res) {
    try {
      const { user_id } = req.params;
      const { coach_intent, coach_need_family, months, property_id, source } = req.query;

      const records = await coachService.getMessageHistory(user_id, {
        coach_intent,
        coach_need_family,
        property_id: property_id || null,
        source: source || null,
        months: months ? parseInt(months) : 12,
      });

      res.json({
        success: true,
        user_id,
        count: records.length,
        records: records.map((r) => ({
          id: r._id,
          property_id: r.property_id || null,
          intent: r.coach_intent,
          family: r.coach_need_family,
          sent_at: r.sent_at,
          // Question utilisateur si disponible (pour reconstruire la conversation)
          user_question: r.context_data?.user_question || null,
          // Contenu complet de la réponse coach
          message_title: r.output_json?.title,
          message_intro: r.output_json?.intro,
          advice_points: r.output_json?.advice_points || [],
          next_action: r.output_json?.next_action || null,
        })),
      });
    } catch (error) {
      logger.error("getMessageHistory failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to get message history",
      });
    }
  }

  /**
   * GET /api/coach/messages/status/:request_id
   * Get request/message status
   */
  async getMessageStatus(req, res) {
    try {
      const { request_id } = req.params;

      const status = await coachService.getRequestStatus(request_id);

      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      logger.error("getMessageStatus failed", { error: error.message });

      if (error.message.includes("not found")) {
        return res.status(404).json({
          success: false,
          error: "Request not found",
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to get message status",
      });
    }
  }

  /**
   * Vérifie que la question porte sur l'immobilier ou un sujet connexe.
   * Retourne true si la question est dans le périmètre du coach.
   * @private
   */
  _isRealEstateQuestion(question) {
    const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Termes immobilier & connexes (FR + EN) — liste large pour éviter les faux positifs
    const realEstatePattern = /\b(immobilier|bien|propriete|appartement|maison|studio|loft|villa|terrain|immeuble|local|commerce|bureau|entrepot|parking|cave|garage|chalet|logement|residence|habitation|batiment|construction|copropriete|syndic|charges|lot|tantieme|quote.?part|mur|facade|toiture|toit|comble|sous.?sol|grenier|balcon|terrasse|jardin|piscine)\b|\b(vente|achat|acheteur|vendeur|acquereu|cession|mutation|transaction|location|loyer|bail|locataire|bailleur|proprietaire|locatif|investissem|rendement|rentabilite|plus.?value|minus.?value)\b|\b(compromis|promesse|acte|avant.?contrat|offre|contre.?offre|negociation|signature|notaire|clause|condition|suspensiv|levee|realisation)\b|\b(credit|pret|taux|apport|financement|mensualite|ptz|hypotheque|caution|garantie|emprunt|banque|assurance|courtier)\b|\b(dpe|diagnostic|amiante|plomb|termite|electricite|gaz|erp|carrez|boutin|alur|hoguet|pinel|denormandie|malraux|lmnp|sci|nu.?propriete|usufruit|viager|donation)\b|\b(m2|metre carre|surface|piece|chambre|salle de bain|cuisine|salon|sejour|bureau|etage|rez.?de.?chaussee|ascenseur|digicode|interphone)\b|\b(marche|prix|estimation|evaluation|expertise|valeur|dvf|meilleurs agents|notaires de france|seloger|leboncoin|pap|foncier|taxe|cfe|tva|droit de mutation)\b|\b(agence|agent|chasseur|mandataire|promoteur|constructeur|architecte|geometre|maitre d.oeuvre|entreprise de travaux|artisan|peinture|renovation|travaux|devis|permis de construire|declaration)\b|\b(real estate|property|apartment|house|flat|rent|lease|mortgage|loan|offer|purchase|sale|landlord|tenant|buyer|seller|contract|notary|valuation|estimate)\b/i;

    return realEstatePattern.test(q);
  }

  /**
   * POST /api/coach/ask
   * User asks Coach a free-form question about real estate
   */
  async askCoach(req, res) {
    try {
      const { user_id, property_id, question, transaction_type, source } = req.body;

      if (!user_id || !question) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: user_id, question",
        });
      }

      // Garde-fou : refus des questions hors périmètre immobilier (sans appel LLM)
      if (question.trim().length >= 15 && !this._isRealEstateQuestion(question)) {
        logger.info("askCoach blocked: off-topic question", { user_id, question_length: question.length });
        return res.status(200).json({
          success: true,
          message_id: null,
          title: "Question hors périmètre",
          answer: "Je suis spécialisé dans l'immobilier et les transactions immobilières. Je ne peux pas répondre à cette question. Posez-moi une question sur la vente, l'achat, la location, le financement ou la réglementation immobilière.",
          advice_points: [],
          next_action: null,
          sent_at: new Date().toISOString(),
          off_topic: true,
        });
      }

      // Create a user question request with special intent
      const request = await coachService.ingestEvent({
        event_id: `user-question-${Date.now()}`,
        user_id,
        property_id: property_id || null,
        transaction_id: null,
        trigger_ref: "USER_QUESTION", // Special trigger for user questions
        payload_json: {
          question,
          transaction_type: transaction_type || "VENTE",
          is_user_initiated: true,
        },
      });

      // Immediately generate response (skip planning/deduping for user questions)
      const record = await coachService.generateMessage(request._id, {
        user_question: question,
        user_id,
        property_id,
        source,
      });

      res.status(201).json({
        success: true,
        message_id: record._id,
        title: record.output_json?.title || "Conseil du Coach IA",
        answer: record.output_json?.intro || "Coach IA analyse votre question...",
        advice_points: record.output_json?.advice_points || [],
        next_action: record.output_json?.next_action || null,
        sent_at: record.sent_at,
      });
    } catch (error) {
      logger.error("askCoach failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to get coach response",
        details: error.message,
      });
    }
  }

  /**
   * GET /api/coach/triggers
   * List all available triggers
   */
  async listTriggers(req, res) {
    try {
      const { transaction_type } = req.query;

      let triggers;
      if (transaction_type) {
        triggers = coachTriggerService.getTriggersByType(transaction_type);
      } else {
        triggers = require("../constants/coachConstants").COACH_TRIGGER_REGISTRY;
      }

      res.json({
        success: true,
        count: triggers.length,
        triggers: triggers.map((t) => ({
          trigger_ref: t.trigger_ref,
          transaction_type: t.transaction_type,
          coach_intent: t.coach_intent,
          coach_need_family: t.coach_need_family,
        })),
      });
    } catch (error) {
      logger.error("listTriggers failed", { error: error.message });
      res.status(500).json({
        success: false,
        error: "Failed to list triggers",
      });
    }
  }
}

module.exports = new CoachController();
