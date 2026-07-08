/**
 * Coach Trigger Service
 * Resolves trigger events to coach intents, families, and dedup keys
 */

const {
  COACH_TRIGGER_REGISTRY,
  DEDUPE_RULES,
} = require("../constants/coachConstants");

class CoachTriggerService {
  /**
   * Resolve a trigger_ref to coach intent metadata
   * @param {string} trigger_ref - Trigger reference (e.g., "OC_V01")
   * @param {Object} context - Optional contextual data for key interpolation
   * @returns {Object} { coach_intent, coach_need_family, context_transition_key, multi_intent_allowed_in_family, ... }
   * @throws {Error} If trigger not found
   */
  async resolveTrigger(trigger_ref, context = {}) {
    // Special handling for user questions
    if (trigger_ref === "USER_QUESTION") {
      return {
        trigger_ref,
        transaction_type: context.transaction_type || "VENTE",
        funnel_status: "user_question",
        coach_intent: "user_question",
        coach_need_family: "user_support",
        multi_intent_allowed_in_family: true,
        context_transition_key: `user_question_${context.user_id || "unknown"}`,
        dedupe_window_months: 0, // No deduplication for user questions
      };
    }

    const trigger = COACH_TRIGGER_REGISTRY.find(
      (t) => t.trigger_ref === trigger_ref
    );

    if (!trigger) {
      throw new Error(`Unknown trigger: ${trigger_ref}`);
    }

    // Interpolate context_transition_key if needed
    let contextTransitionKey = trigger.context_transition_key;
    if (contextTransitionKey.includes("${")) {
      contextTransitionKey = this._interpolateKey(contextTransitionKey, context);
    }

    return {
      trigger_ref,
      transaction_type: trigger.transaction_type,
      funnel_status: trigger.funnel_status,
      coach_intent: trigger.coach_intent,
      coach_need_family: trigger.coach_need_family,
      multi_intent_allowed_in_family: trigger.multi_intent_allowed_in_family,
      context_transition_key: contextTransitionKey,
      dedupe_window_months: trigger.dedupe_window_months,
    };
  }

  /**
   * Get deduplication rules for a family
   * @param {string} family - Coach need family
   * @returns {Object} { type, window_months, allows_context_transition }
   */
  getDedupeRules(family) {
    return (
      DEDUPE_RULES[family] || {
        type: "context",
        window_months: 12,
        allows_context_transition: true,
      }
    );
  }

  /**
   * Get all triggers by transaction type
   * @param {string} transactionType - "VENTE" or "LOCATION"
   * @returns {Array} Array of trigger definitions
   */
  getTriggersByType(transactionType) {
    return COACH_TRIGGER_REGISTRY.filter(
      (t) => t.transaction_type === transactionType
    );
  }

  /**
   * Get all triggers by coach intent
   * @param {string} intent - Coach intent (e.g., "welcome_first_lead_sale")
   * @returns {Array} Array of trigger definitions
   */
  getTriggersByIntent(intent) {
    return COACH_TRIGGER_REGISTRY.filter((t) => t.coach_intent === intent);
  }

  /**
   * Helper: Interpolate context variables into key template
   * Example: "post_visit_${lead_id}" + { lead_id: "123" } -> "post_visit_123"
   * @private
   */
  _interpolateKey(template, context) {
    return template.replace(/\$\{(\w+)\}/g, (match, key) => {
      return context[key] || match; // fallback to ${key} if not in context
    });
  }
}

module.exports = new CoachTriggerService();
