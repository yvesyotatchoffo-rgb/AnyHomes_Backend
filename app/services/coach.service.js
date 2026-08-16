/**
 * Coach Orchestration Service
 * Main service that coordinates the entire message generation pipeline
 */

const db = require("../models");
const coachTriggerService = require("./coachTrigger.service");
const coachDedupeService = require("./coachDedupe.service");
const coachPromptService = require("./coachPrompt.service");
const coachLLMService = require("./coachLLM.service");
const coachValidatorService = require("./coachValidator.service");
const { sendCoachNotificationEmail } = require("../Emails/coachEmail");
const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachService");

class CoachService {
  /**
   * Ingest an event and create a message request
   * @param {Object} params - { event_id, user_id, property_id, transaction_id, trigger_ref, payload_json }
   * @returns {Promise<Object>} Created message request
   */
  async ingestEvent(params) {
    const {
      event_id,
      user_id,
      property_id,
      transaction_id,
      trigger_ref,
      payload_json = {},
    } = params;

    try {
      // Resolve trigger to get coach intent metadata
      const triggerMetadata = await coachTriggerService.resolveTrigger(
        trigger_ref,
        payload_json
      );

      // Create message request (initial status: received)
      const request = await db.CoachMessageRequest.create({
        event_id,
        user_id,
        property_id,
        transaction_id,
        trigger_ref,
        coach_intent: triggerMetadata.coach_intent,
        coach_need_family: triggerMetadata.coach_need_family,
        context_transition_key: triggerMetadata.context_transition_key,
        payload_json,
        status: "received",
      });

      logger.info("Event ingested", {
        event_id,
        user_id,
        trigger_ref,
        request_id: request._id,
      });

      return request;
    } catch (error) {
      logger.error("Event ingestion failed", { event_id, error: error.message });
      throw error;
    }
  }

  /**
   * Plan a message (deduplication check)
   * @param {Object} requestId - MongoDB request ID
   * @returns {Promise<Object>} Updated request with dedupe result
   */
  async planMessage(requestId) {
    try {
      const request = await db.CoachMessageRequest.findById(requestId);
      if (!request) {
        throw new Error(`Request not found: ${requestId}`);
      }

      // Check deduplication
      const dedupeResult = await coachDedupeService.isAllowed({
        user_id: request.user_id,
        coach_intent: request.coach_intent,
        coach_need_family: request.coach_need_family,
        context_transition_key: request.context_transition_key,
        dedupe_window_months: 12,
      });

      if (!dedupeResult.allowed) {
        request.status = "dedupe_blocked";
        await request.save();

        logger.info("Message blocked by deduplication", {
          request_id: requestId,
          reason: dedupeResult.reason,
        });

        return request;
      }

      // Move to generation phase
      request.status = "generation_pending";
      await request.save();

      logger.info("Message planned (dedupe passed)", {
        request_id: requestId,
      });

      return request;
    } catch (error) {
      logger.error("Message planning failed", {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate message content via LLM
   * @param {Object} requestId - MongoDB request ID
   * @param {Object} contextData - Additional context for prompt building
   * @returns {Promise<Object>} Created message record with LLM output
   */
  async generateMessage(requestId, contextData = {}) {
    try {
      const request = await db.CoachMessageRequest.findById(requestId);
      if (!request) {
        throw new Error(`Request not found: ${requestId}`);
      }

      // For user questions, skip status check (immediate generation)
      const isUserQuestion = request.trigger_ref === "USER_QUESTION";
      
      if (!isUserQuestion && request.status !== "generation_pending") {
        throw new Error(
          `Cannot generate: request status is ${request.status}, expected generation_pending`
        );
      }

      // Charge les caractéristiques du bien concerné pour permettre une
      // réponse LLM contextualisée (question libre posée par l'utilisateur)
      const propertyContext = await this._buildPropertyContext(request.property_id);

      // Build prompt
      const promptData = coachPromptService.buildPrompt({
        coach_intent: request.coach_intent,
        transaction_type: request.payload_json.transaction_type,
        context_data: {
          ...contextData,
          // Use question from payload only if contextData doesn't already have it (avoid overwriting with undefined)
          user_question: contextData.user_question || request.payload_json.question,
          property_context: propertyContext || contextData.property_context || null,
        },
      });

      // Call LLM
      const llmResult = await coachLLMService.generateMessage({
        system_prompt: promptData.system,
        user_prompt: promptData.user_prompt,
        output_schema: promptData.output_schema,
        intent_id: request.coach_intent,
      });

      if (!llmResult.success) {
        throw new Error(`LLM generation failed: ${llmResult.error}`);
      }

      // Create message record
      const record = await db.CoachMessageRecord.create({
        request_id: requestId,
        event_id: request.event_id,
        user_id: request.user_id,
        property_id: request.property_id,
        transaction_id: request.transaction_id,
        trigger_ref: request.trigger_ref,
        coach_intent: request.coach_intent,
        coach_need_family: request.coach_need_family,
        context_transition_key: request.context_transition_key,
        // Sauvegarder la question utilisateur pour reconstruire la conversation dans l'historique
        user_question: contextData.user_question || null,
        source: contextData.source || "dashboard",
        prompt_version: "v1.0",
        model_version: "deepseek-v4-flash",
        status: "generated",
        output_json: llmResult.message,
        llm_latency_ms: llmResult.latency_ms,
        token_input: llmResult.token_input,
        token_output: llmResult.token_output,
        estimated_cost_usd: llmResult.cost_usd,
        sent_at: new Date(), // Mark as sent immediately for user questions
      });

      // Update request
      request.status = "generated";
      await request.save();

      logger.info("Message generated", {
        request_id: requestId,
        record_id: record._id,
        latency_ms: llmResult.latency_ms,
        cost_usd: llmResult.cost_usd,
        isUserQuestion,
      });

      // Send notification email for spontaneous messages (non user_question)
      if (!isUserQuestion && request.trigger_ref !== "USER_QUESTION") {
        // Fire-and-forget: send email asynchronously without blocking response
        this._sendNotificationEmailAsync(record, request).catch((err) => {
          logger.error("Failed to send notification email", {
            record_id: record._id,
            error: err.message,
          });
        });
      }

      return record;
    } catch (error) {
      logger.error("Message generation failed", {
        requestId,
        error: error.message,
      });

      // Mark request as failed
      const request = await db.CoachMessageRequest.findById(requestId);
      if (request) {
        request.status = "validation_failed";
        await request.save();
      }

      throw error;
    }
  }

  /**
   * Validate and repair message if needed
   * @param {Object} recordId - MongoDB record ID
   * @returns {Promise<Object>} Updated record with validation result
   */
  async validateMessage(recordId) {
    try {
      const record = await db.CoachMessageRecord.findById(recordId);
      if (!record) {
        throw new Error(`Record not found: ${recordId}`);
      }

      // Validate
      const validation = coachValidatorService.validateMessage(record.output_json);

      if (!validation.valid) {
        logger.warn("Message validation failed", {
          record_id: recordId,
          errors: validation.errors,
        });

        record.validation_result = "invalid_json";
        record.status = "validation_failed";
        await record.save();

        return record;
      }

      // Extract quality flags
      const qualityFlags = {
        has_invention_risk: validation.warnings.some((w) =>
          w.includes("invention_risk")
        ),
        has_tone_mismatch: validation.warnings.some((w) =>
          w.includes("tone_mismatch")
        ),
        has_length_violation: validation.warnings.some((w) =>
          w.includes("length_violation")
        ),
        has_prompt_injection_risk: validation.warnings.some((w) =>
          w.includes("injection")
        ),
      };

      record.validation_result = "valid";
      record.quality_flags_json = qualityFlags;
      record.status = "valid"; // Can be sent
      await record.save();

      logger.info("Message validated", {
        record_id: recordId,
        warnings: validation.warnings.length,
      });

      return record;
    } catch (error) {
      logger.error("Message validation failed", {
        recordId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send message (mark as sent, record in history)
   * @param {Object} recordId - MongoDB record ID
   * @param {string} channel - 'realtime' or 'polling'
   * @returns {Promise<Object>} Updated record
   */
  async sendMessage(recordId, channel = "polling") {
    try {
      const record = await db.CoachMessageRecord.findById(recordId);
      if (!record) {
        throw new Error(`Record not found: ${recordId}`);
      }

      // Record in history for deduplication
      await coachDedupeService.recordSent({
        user_id: record.user_id,
        coach_intent: record.coach_intent,
        coach_need_family: record.coach_need_family,
        context_transition_key: record.context_transition_key,
        source_record_id: recordId,
        source_trigger_ref: record.trigger_ref,
        prompt_version: record.prompt_version,
        model_version: record.model_version,
      });

      // Update record
      record.sent_at = new Date();
      record.sent_to_channel = channel;
      record.status = "sent";
      await record.save();

      logger.info("Message sent", {
        record_id: recordId,
        channel,
        user_id: record.user_id,
      });

      // ── Phase 2: WebSocket Real-Time Broadcast ────
      // If WebSocket is enabled, broadcast to connected clients
      if (global.coachWebSocketHandler && channel === "realtime") {
        try {
          const messagePayload = {
            type: "message",
            data: {
              id: record._id,
              title: record.output_json?.title,
              intro: record.output_json?.intro,
              advice_points: record.output_json?.advice_points || [],
              next_action: record.output_json?.next_action,
              resource: record.output_json?.resource,
              sentiment: record.output_json?.sentiment,
              coach_intent: record.coach_intent,
              coach_need_family: record.coach_need_family,
              sent_at: record.sent_at,
            },
            timestamp: new Date(),
          };

          const result = global.coachWebSocketHandler.broadcastToUser(
            record.user_id,
            messagePayload
          );

          logger.info("Message broadcast via WebSocket", {
            record_id: recordId,
            user_id: record.user_id,
            sent: result.sent,
            queued: result.queued,
          });
        } catch (error) {
          logger.warn("WebSocket broadcast failed (polling fallback will handle)", {
            record_id: recordId,
            error: error.message,
          });
        }
      }

      return record;
    } catch (error) {
      logger.error("Message send failed", { recordId, error: error.message });
      throw error;
    }
  }

  /**
   * Get message history for user
   * @param {string} user_id
   * @param {Object} filters - Optional filters (coach_intent, coach_need_family, months)
   * @returns {Promise<Array>}
   */
  async getMessageHistory(user_id, filters = {}) {
    try {
      const query = { user_id };

      if (filters.coach_intent) {
        query.coach_intent = filters.coach_intent;
      }

      if (filters.coach_need_family) {
        query.coach_need_family = filters.coach_need_family;
      }

      // Isoler la conversation par bien : chaque bien a son propre historique
      if (filters.property_id) {
        query.property_id = filters.property_id;
      }

      // Isoler la conversation par écran d'origine (ex: "coach-immo")
      if (filters.source) {
        query.source = filters.source;
      }

      const months = filters.months || 12;
      const lookbackDate = new Date();
      lookbackDate.setMonth(lookbackDate.getMonth() - months);
      query.sent_at = { $gte: lookbackDate };

      const records = await db.CoachMessageRecord.find(query)
        .sort({ sent_at: 1 }) // Ascendant : plus ancien en premier, plus récent en bas
        .limit(50);

      return records;
    } catch (error) {
      logger.error("Failed to get message history", {
        user_id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Construit un bloc texte lisible décrivant le bien concerné, pour
   * injecter ses caractéristiques dans le prompt LLM.
   * @param {string} propertyId - Identifiant du bien
   * @returns {Promise<string|null>} Description du bien ou null si introuvable
   * @private
   */
  async _buildPropertyContext(propertyId) {
    if (!propertyId) return null;

    try {
      const property = await db.property.findById(propertyId).select(
        "propertyTitle address city postalCode propertyType listingType surface rooms bedrooms price propertyMonthlyCharges"
      );
      if (!property) {
        logger.warn("Property not found for coach context", { property_id: propertyId });
        return null;
      }

      const lines = [];
      if (property.propertyTitle) lines.push(`Titre: ${property.propertyTitle}`);
      if (property.address) lines.push(`Adresse: ${property.address}`);
      if (property.city) lines.push(`Ville: ${property.city}`);
      if (property.postalCode) lines.push(`Code postal: ${property.postalCode}`);
      const listingType =
        property.listingType || property.propertyType || null;
      if (listingType) {
        const label =
          listingType === "rent" || listingType === "rental"
            ? "À louer"
            : listingType === "sale"
            ? "À vendre"
            : listingType;
        lines.push(`Type de transaction: ${label}`);
      }
      if (property.surface) lines.push(`Surface: ${property.surface} m²`);
      if (property.rooms) lines.push(`Pièces: ${property.rooms}`);
      if (property.bedrooms) lines.push(`Chambres: ${property.bedrooms}`);
      if (property.price) lines.push(`Prix: ${Number(property.price).toLocaleString("fr-FR")} €`);
      if (property.propertyMonthlyCharges)
        lines.push(`Charges mensuelles: ${Number(property.propertyMonthlyCharges).toLocaleString("fr-FR")} €`);

      return lines.length > 0 ? lines.join("\n") : null;
    } catch (error) {
      logger.warn("Failed to build property context", {
        property_id: propertyId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Send notification email asynchronously (fire-and-forget)
   * Called for spontaneous coach messages
   * @private
   * @param {Object} record - CoachMessageRecord
   * @param {Object} request - CoachMessageRequest
   */
  async _sendNotificationEmailAsync(record, request) {
    try {
      // Fetch user data
      const user = await db.users.findById(record.user_id).select(
        "email firstName lastName"
      );
      if (!user || !user.email) {
        logger.warn("User not found or has no email", {
          user_id: record.user_id,
        });
        return;
      }

      // Fetch property data
      const property = await db.property.findById(record.property_id).select(
        "propertyTitle surface city postalCode propertyType listingType images"
      );
      if (!property) {
        logger.warn("Property not found", {
          property_id: record.property_id,
        });
        return;
      }

      // Determine redirect URL based on transaction context
      let redirectUrl = `${process.env.FRONT_WEB_URL}/real-estate-transaction-searcher`;
      
      // Check if this is an owner transaction
      if (request.payload_json?.transaction_type === "VENTE" || 
          request.payload_json?.transaction_type === "LOCATION") {
        redirectUrl = `${process.env.FRONT_WEB_URL}/real-estate-transaction-owner`;
      }

      // Get property image
      const propertyImage =
        property.images && property.images.length > 0
          ? `${process.env.BACK_WEB_URL}${property.images[0].file}`
          : null;

      // Prepare email options
      const emailOptions = {
        recipientEmail: user.email,
        recipientName: user.firstName || user.lastName || "User",
        propertyTitle: property.propertyTitle || "Votre bien",
        surface: property.surface,
        city: property.city,
        postalCode: property.postalCode,
        listingType: property.propertyType || property.listingType,
        propertyImage,
        redirectUrl,
      };

      // Send email
      logger.info("Sending coach notification email", {
        record_id: record._id,
        user_email: user.email,
        property_id: record.property_id,
      });

      const result = await sendCoachNotificationEmail(emailOptions);

      if (result.success) {
        logger.info("Coach notification email sent successfully", {
          record_id: record._id,
          messageId: result.messageId,
        });
      } else {
        logger.error("Coach notification email failed", {
          record_id: record._id,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error("Error sending notification email", {
        record_id: record._id,
        error: error.message,
      });
    }
  }

  /**
   * Get request status
   * @param {string} requestId - MongoDB request ID or event_id
   * @returns {Promise<Object>}
   */
  async getRequestStatus(requestId) {
    try {
      // Try ObjectId first, then event_id
      let request;
      try {
        request = await db.CoachMessageRequest.findById(requestId);
      } catch (e) {
        request = await db.CoachMessageRequest.findOne({ event_id: requestId });
      }

      if (!request) {
        throw new Error(`Request not found: ${requestId}`);
      }

      // Get associated record if exists
      let record = null;
      if (request.status === "generated" || request.status === "sent") {
        record = await db.CoachMessageRecord.findOne({ request_id: request._id });
      }

      return {
        request_id: request._id,
        event_id: request.event_id,
        status: request.status,
        created_at: request.created_at,
        record: record
          ? {
              id: record._id,
              status: record.status,
              output: record.output_json,
              sent_at: record.sent_at,
            }
          : null,
      };
    } catch (error) {
      logger.error("Failed to get request status", {
        requestId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new CoachService();
