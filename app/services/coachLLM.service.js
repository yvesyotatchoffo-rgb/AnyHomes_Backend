/**
 * Coach LLM Service
 * Supports multiple LLM providers: DeepSeek, Ollama, OpenAI
 */

const axios = require("axios");
const { LLM_CONFIG, LLM_PRICING } = require("../constants/coachConstants");
const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachLLMService");

class CoachLLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || "ollama";
    this.model = LLM_CONFIG.model;
    
    // Provider-specific config
    switch (this.provider) {
      case "perplexity":
        this.apiKey = process.env.PERPLEXITY_API_KEY || "";
        this.apiBase = "https://api.perplexity.ai";
        this.model = process.env.PERPLEXITY_MODEL || "sonar"; // sonar = web search en temps réel
        if (!this.apiKey) {
          logger.warn("Perplexity selected but PERPLEXITY_API_KEY not configured, falling back to nvidia");
          this.provider = "nvidia";
          this.apiKey = process.env.NVIDIA_API_KEY || "";
          this.apiBase = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
          this.model = LLM_CONFIG.model;
        }
        // Toujours stocker NVIDIA comme fallback pour les messages spontanés (pas besoin de données live)
        this.nvidiaApiKey = process.env.NVIDIA_API_KEY || "";
        this.nvidiaApiBase = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
        this.nvidiaModel = LLM_CONFIG.model;
        break;
      case "nvidia":
        this.apiKey = process.env.NVIDIA_API_KEY || "";
        this.apiBase = process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1";
        if (!this.apiKey) {
          logger.warn("NVIDIA selected but NVIDIA_API_KEY not configured, falling back to Ollama");
          this.provider = "ollama";
        }
        break;
      case "deepseek":
        this.apiKey = process.env.DEEPSEEK_API_KEY || "";
        this.apiBase = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";
        this.model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
        if (!this.apiKey) {
          logger.warn("DeepSeek selected but DEEPSEEK_API_KEY not configured, falling back to Ollama");
          this.provider = "ollama";
        }
        break;
      case "openai":
        this.apiKey = process.env.OPENAI_API_KEY || "";
        this.apiBase = "https://api.openai.com";
        this.model = "gpt-3.5-turbo";
        if (!this.apiKey) {
          logger.warn("OpenAI selected but OPENAI_API_KEY not configured, falling back to Ollama");
          this.provider = "ollama";
        }
        break;
      case "ollama":
      default:
        this.apiBase = process.env.OLLAMA_API_BASE || "http://localhost:11434";
        this.model = process.env.OLLAMA_MODEL || "mistral";
        this.provider = "ollama";
    }
    
    logger.info(`LLM Service initialized with provider: ${this.provider}`);
  }

  /**
   * Generate message via LLM
   * @param {Object} params - { system_prompt, user_prompt, output_schema, intent_id }
   * @returns {Promise<Object>} { success, message, tokens, cost_usd, latency_ms, error }
   */
  async generateMessage(params) {
    const { system_prompt, user_prompt, output_schema, intent_id = "" } = params;
    const startTime = Date.now();

    // Append explicit JSON format to user prompt so the LLM knows exactly which fields to return
    const schemaGuide = output_schema
      ? `\n\nRETOURNE UNIQUEMENT un objet JSON valide avec EXACTEMENT ces champs (pas d'autres):\n{\n  "title": "Titre court et accrocheur (10-100 caractères)",\n  "intro": "Introduction en 1-2 phrases contextualisée à la question",\n  "advice_points": ["Point 1 (peut être long : plusieurs phrases ou une section rédigée)", "Point 2...", "Point 3..."],\n  "next_action": "Prochaine action prioritaire à réaliser"\n}\n\nIMPORTANT: Si la question demande de rédiger un modèle/exemple/document, chaque élément de advice_points doit être une SECTION RÉDIGÉE COMPLÈTE (ex: clauses, articles, paragraphes). Ne résume pas, rédige vraiment.`
      : '';
    const enhanced_user_prompt = user_prompt + schemaGuide;

    // ROUTAGE COÛT : Perplexity (web search) uniquement pour les intents qui nécessitent des données live
    // Tous les messages spontanés (OC_V*, OC_L*) → NVIDIA llama (gratuit, suffisant pour conseils statiques)
    const needsLiveData = LLM_CONFIG.live_data_intents.includes(intent_id);
    const routeToNvidia = this.provider === "perplexity" && !needsLiveData && this.nvidiaApiKey;

    // System prompt adapté : Perplexity a accès aux données en temps réel, pas NVIDIA
    const perplexitySystemPrompt = `Tu es un coach transactionnel pour les professionnels de l'immobilier.
Tu fournis des conseils pratiques, bienveillants et actionables basés sur les données actuelles du marché.
Tu as accès à des informations à jour via la recherche web. Cite tes sources quand tu donnes des prix ou statistiques.
Réponds UNIQUEMENT en JSON valide, strictement conforme au schéma spécifié.
Ton ton doit être professionnel, confiant et factuel.

PÉRIMÈTRE STRICT : Tu réponds UNIQUEMENT aux questions portant sur l'immobilier, les transactions immobilières, le financement, la réglementation, le marché ou les sujets directement connexes.
Si la question ne porte pas sur l'immobilier, réponds avec : {"title":"Hors périmètre","intro":"Je suis spécialisé dans l'immobilier. Cette question ne relève pas de mon domaine d'expertise.","advice_points":["Posez-moi une question sur la vente, l'achat, la location, le financement ou la réglementation immobilière."],"next_action":"Reformulez votre question sur un sujet immobilier."}`;

    try {
      let response;
      
      if (routeToNvidia) {
        // Messages spontanés → NVIDIA (pas besoin de web search, économie Perplexity)
        logger.info("Routing to NVIDIA (no live data needed)", { intent_id });
        response = await this._callNvidiaWithConfig(
          { system_prompt, user_prompt: enhanced_user_prompt },
          this.nvidiaApiKey, this.nvidiaApiBase, this.nvidiaModel
        );
      } else if (this.provider === "perplexity") {
        // Questions libres → Perplexity avec web search + enhanced_user_prompt
        response = await this._callPerplexity({ system_prompt: perplexitySystemPrompt, user_prompt: enhanced_user_prompt });
      } else if (this.provider === "nvidia") {
        response = await this._callNvidia({ system_prompt, user_prompt: enhanced_user_prompt });
      } else if (this.provider === "deepseek") {
        response = await this._callDeepSeek({ system_prompt, user_prompt: enhanced_user_prompt });
      } else if (this.provider === "openai") {
        response = await this._callOpenAI({ system_prompt, user_prompt: enhanced_user_prompt });
      } else {
        response = await this._callOllama({ system_prompt, user_prompt: enhanced_user_prompt });
      }

      const latency_ms = Date.now() - startTime;
      const token_input = response.usage?.prompt_tokens || this.countTokens(system_prompt + enhanced_user_prompt);
      const token_output = response.usage?.completion_tokens || this.countTokens(response.choices[0]?.message?.content || "");
      const estimated_cost_usd = this._estimateCost(token_input, token_output);

      // Parse response
      const messageContent = response.choices[0]?.message?.content || "";
      let message;

      try {
        message = JSON.parse(messageContent);
      } catch (e) {
        logger.warn("Failed to parse LLM response as JSON, attempting repair", {
          intent_id,
          error: e.message,
        });
        message = this._repairJSON(messageContent);
      }

      logger.info("LLM generation successful", {
        provider: this.provider,
        intent_id,
        latency_ms,
        token_input,
        token_output,
      });

      return {
        success: true,
        message,
        token_input,
        token_output,
        cost_usd: estimated_cost_usd,
        latency_ms,
      };
    } catch (error) {
      const latency_ms = Date.now() - startTime;
      logger.error("LLM generation failed, using smart fallback", {
        provider: this.provider,
        intent_id,
        error: error.message,
        latency_ms,
      });

      // Return a smart fallback based on intent instead of throwing
      const fallbackMessage = this._buildFallbackResponse(intent_id, user_prompt);
      return {
        success: true,
        message: fallbackMessage,
        token_input: 0,
        token_output: 0,
        cost_usd: 0,
        latency_ms,
        is_fallback: true,
      };
    }
  }

  /**
   * Call Perplexity API — modèle sonar avec recherche web en temps réel
   * @private
   */
  async _callPerplexity({ system_prompt, user_prompt }, retryCount = 0) {
    const request = {
      model: this.model, // "sonar" or "sonar-pro"
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.perplexity_max_tokens || 700, // Réduit vs NVIDIA pour maîtriser les coûts
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
    };

    try {
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        request,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: LLM_CONFIG.timeout_ms,
        }
      );
      return response.data;
    } catch (error) {
      if (retryCount < LLM_CONFIG.max_retries && (error.response?.status === 429 || error.response?.status >= 500)) {
        const delayMs = LLM_CONFIG.retry_delay_ms * Math.pow(2, retryCount);
        await this._sleep(delayMs);
        return this._callPerplexity({ system_prompt, user_prompt }, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Call NVIDIA NIM API with explicit config (used for routing from Perplexity provider)
   * @private
   */
  async _callNvidiaWithConfig({ system_prompt, user_prompt }, apiKey, apiBase, model, retryCount = 0) {
    const request = {
      model,
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.max_tokens,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
    };
    try {
      const response = await axios.post(
        `${apiBase}/chat/completions`,
        request,
        {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: LLM_CONFIG.timeout_ms,
        }
      );
      return response.data;
    } catch (error) {
      if (retryCount < LLM_CONFIG.max_retries && (error.response?.status === 429 || error.response?.status >= 500)) {
        await this._sleep(LLM_CONFIG.retry_delay_ms * Math.pow(2, retryCount));
        return this._callNvidiaWithConfig({ system_prompt, user_prompt }, apiKey, apiBase, model, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Call NVIDIA NIM API (compatible with OpenAI API)
   * @private
   */
  async _callNvidia({ system_prompt, user_prompt }, retryCount = 0) {
    const request = {
      model: this.model,
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.max_tokens,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
    };

    try {
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        request,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: LLM_CONFIG.timeout_ms,
        }
      );
      return response.data;
    } catch (error) {
      if (retryCount < LLM_CONFIG.max_retries && (error.response?.status === 429 || error.response?.status >= 500)) {
        const delayMs = LLM_CONFIG.retry_delay_ms * Math.pow(2, retryCount);
        await this._sleep(delayMs);
        return this._callNvidia({ system_prompt, user_prompt }, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Call DeepSeek API
   * @private
   */
  async _callDeepSeek({ system_prompt, user_prompt }, retryCount = 0) {
    const request = {
      model: this.model,
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.max_tokens,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
    };

    try {
      const response = await axios.post(
        `${this.apiBase}/v1/chat/completions`,
        request,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: LLM_CONFIG.timeout_ms,
        }
      );
      return response.data;
    } catch (error) {
      if (retryCount < LLM_CONFIG.max_retries && (error.response?.status === 429 || error.response?.status >= 500)) {
        const delayMs = LLM_CONFIG.retry_delay_ms * Math.pow(2, retryCount);
        await this._sleep(delayMs);
        return this._callDeepSeek({ system_prompt, user_prompt }, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Call OpenAI API
   * @private
   */
  async _callOpenAI({ system_prompt, user_prompt }) {
    const request = {
      model: this.model,
      temperature: LLM_CONFIG.temperature,
      max_tokens: LLM_CONFIG.max_tokens,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
    };

    const response = await axios.post(
      `${this.apiBase}/v1/chat/completions`,
      request,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: LLM_CONFIG.timeout_ms,
      }
    );
    return response.data;
  }

  /**
   * Call Ollama API (local)
   * @private
   */
  async _callOllama({ system_prompt, user_prompt }) {
    const request = {
      model: this.model,
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_prompt },
      ],
      stream: false,
    };

    try {
      const response = await axios.post(
        `${this.apiBase}/api/chat`,
        request,
        {
          timeout: 30000, // Ollama can be slow
        }
      );

      // Ollama response format is different, convert to OpenAI format
      return {
        choices: [
          {
            message: {
              content: response.data.message?.content || "",
            },
          },
        ],
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
        },
      };
    } catch (error) {
      logger.error("Ollama error", { error: error.message });
      // If Ollama fails, return a fallback response
      if (error.code === "ECONNREFUSED") {
        logger.warn("Ollama not available at " + this.apiBase + ", using fallback response");
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Conseil du Coach IA",
                  intro: "Merci pour votre question! Voici quelques conseils importants pour progresser dans votre transaction immobilière.",
                  advice_points: [
                    "Assurez-vous que tous vos documents sont à jour et complets",
                    "Communiquez régulièrement avec votre agent",
                    "Gardez une trace de toutes les étapes importantes",
                  ],
                  next_action: "Continuez à suivre les étapes de votre transaction",
                }),
              },
            },
          ],
        };
      }
      throw error;
    }
  }

  /**
   * Build a smart fallback response based on intent when LLM is unavailable
   * @private
   */
  _buildFallbackResponse(intent_id = "", user_prompt = "") {
    const fallbacks = {
      user_question: {
        title: "Conseils de votre Coach IA",
        intro: "Voici les points clés pour avancer efficacement dans votre transaction immobilière.",
        advice_points: [
          "Gardez tous vos documents importants (compromis, diagnostics, DPE) bien organisés et accessibles.",
          "Communiquez régulièrement avec votre notaire et agent pour suivre les délais.",
          "N'hésitez pas à poser des questions à chaque étape — chaque détail compte.",
          "Vérifiez les conditions suspensives de votre accord et leurs délais.",
        ],
        next_action: "Consultez le tableau de bord de votre transaction pour voir les prochaines étapes.",
      },
      welcome_first_lead_sale: {
        title: "Félicitations ! Votre premier prospect est arrivé",
        intro: "Vous avez reçu votre premier intérêt. C'est le moment de faire bonne impression.",
        advice_points: [
          "Répondez rapidement — les acheteurs contactent souvent plusieurs vendeurs en parallèle.",
          "Préparez une présentation claire de votre bien (photos, diagnostics, DPE).",
          "Proposez plusieurs créneaux de visite flexibles pour maximiser les chances.",
          "Soyez transparent sur l'état du bien pour créer une relation de confiance.",
        ],
        next_action: "Planifiez une visite en proposant des créneaux disponibles dès maintenant.",
      },
      prepare_visit_sale: {
        title: "Préparez votre visite avec soin",
        intro: "Une bonne préparation augmente significativement vos chances de conclure.",
        advice_points: [
          "Nettoyez et désencombrez chaque pièce pour maximiser l'espace perçu.",
          "Assurez-vous que tous les équipements fonctionnent correctement.",
          "Préparez les documents clés : DPE, diagnostics, charges de copropriété.",
          "Choisissez le bon moment de la journée pour valoriser la luminosité.",
        ],
        next_action: "Confirmez le créneau de visite et envoyez un rappel au visiteur.",
      },
      post_visit_next_steps_sale: {
        title: "Après la visite : gardez le contact",
        intro: "Le suivi post-visite est crucial pour transformer l'intérêt en offre.",
        advice_points: [
          "Contactez le visiteur dans les 24h pour recueillir son ressenti.",
          "Répondez à toutes les questions ou objections soulevées pendant la visite.",
          "Si l'intérêt est fort, proposez une seconde visite ou une visite avec l'expert.",
          "Restez disponible et réactif pour maintenir la dynamique.",
        ],
        next_action: "Envoyez un message de suivi au visiteur pour prendre de ses nouvelles.",
      },
    };

    const fallback = fallbacks[intent_id] || fallbacks.user_question;
    return fallback;
  }

  /**
   * Repair malformed JSON response from LLM
   * @private
   */
  _repairJSON(str) {
    try {
      let repaired = str.trim();
      if (repaired.startsWith("```")) {
        repaired = repaired.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      return JSON.parse(repaired);
    } catch (e) {
      logger.error("JSON repair failed, returning fallback object");
      return {
        title: "Conseil du Coach IA",
        intro: "Voici quelques conseils pour progresser.",
        advice_points: [
          "Suivez les étapes recommandées",
          "Consultez les ressources disponibles",
          "N'hésitez pas à poser d'autres questions",
        ],
        next_action: "Continuez votre transaction",
      };
    }
  }

  /**
   * Estimate LLM cost
   * @private
   */
  _estimateCost(inputTokens, outputTokens) {
    const pricing = LLM_PRICING[this.model] || {
      input_per_1m_tokens: 0.05,
      output_per_1m_tokens: 0.1,
    };

    const inputCost = (inputTokens / 1000000) * pricing.input_per_1m_tokens;
    const outputCost = (outputTokens / 1000000) * pricing.output_per_1m_tokens;

    return parseFloat((inputCost + outputCost).toFixed(6));
  }

  /**
   * Count tokens estimate (rough)
   * @private
   */
  countTokens(text) {
    // Rough estimate: 1 token ≈ 4 chars
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep helper
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new CoachLLMService();
