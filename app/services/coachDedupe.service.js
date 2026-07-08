/**
 * Coach Deduplication Service
 * 3-level deduplication logic:
 * Level 1: Same intent, 12mo window
 * Level 2: Same strict family, 12mo window
 * Level 3: Same family but different context_transition_key (multi-intent families)
 */

const db = require("../models");
const coachTriggerService = require("./coachTrigger.service");
const { STRICT_FAMILIES } = require("../constants/coachConstants");
const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachDedupeService");

class CoachDedupeService {
  /**
   * Check if a coach message is allowed (not deduplicated)
   * @param {Object} params - { user_id, coach_intent, coach_need_family, context_transition_key, dedupe_window_months }
   * @returns {Promise<Object>} { allowed: boolean, reason: string }
   */
  async isAllowed(params) {
    const {
      user_id,
      coach_intent,
      coach_need_family,
      context_transition_key,
      dedupe_window_months = 12,
    } = params;

    logger.debug("Checking dedupe for", {
      user_id,
      coach_intent,
      coach_need_family,
      context_transition_key,
    });

    // Calculate lookback window
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - dedupe_window_months);

    try {
      // LEVEL 1: Check for same intent in history
      const sameIntentRecord = await db.CoachMessageHistory.findOne({
        user_id,
        coach_intent,
        sent_at: { $gte: lookbackDate },
        status: "sent",
      });

      if (sameIntentRecord) {
        logger.info("Blocked by LEVEL 1 (same intent)", { user_id, coach_intent });
        return {
          allowed: false,
          reason: "blocked_same_intent",
          blocked_by: "LEVEL_1_SAME_INTENT",
        };
      }

      // LEVEL 2: Check if strict family (block ANY intent in family)
      if (STRICT_FAMILIES.includes(coach_need_family)) {
        const strictFamilyRecord = await db.CoachMessageHistory.findOne({
          user_id,
          coach_need_family,
          sent_at: { $gte: lookbackDate },
          status: "sent",
        });

        if (strictFamilyRecord) {
          logger.info("Blocked by LEVEL 2 (strict family)", {
            user_id,
            coach_need_family,
          });
          return {
            allowed: false,
            reason: "blocked_strict_family",
            blocked_by: "LEVEL_2_STRICT_FAMILY",
          };
        }
      }

      // LEVEL 3: Multi-intent family with context check
      // Check if SAME family + SAME context_transition_key within window
      const sameContextRecord = await db.CoachMessageHistory.findOne({
        user_id,
        coach_need_family,
        context_transition_key,
        sent_at: { $gte: lookbackDate },
        status: "sent",
      });

      if (sameContextRecord) {
        logger.info("Blocked by LEVEL 3 (same family + same context)", {
          user_id,
          coach_need_family,
          context_transition_key,
        });
        return {
          allowed: false,
          reason: "blocked_same_family_same_context",
          blocked_by: "LEVEL_3_SAME_FAMILY_SAME_CONTEXT",
        };
      }

      logger.debug("Message allowed (passed all dedupe checks)", { user_id });
      return {
        allowed: true,
        reason: "no_dedupe_block",
      };
    } catch (error) {
      logger.error("Dedupe check failed", { error, user_id });
      throw error;
    }
  }

  /**
   * Record a sent message in history for future deduplication
   * @param {Object} params - { user_id, coach_intent, coach_need_family, context_transition_key, ... }
   * @returns {Promise<Object>} Saved history record
   */
  async recordSent(params) {
    const {
      user_id,
      coach_intent,
      coach_need_family,
      context_transition_key,
      source_record_id,
      source_trigger_ref,
      prompt_version = "v1.0",
      model_version = "deepseek-v4-flash",
    } = params;

    try {
      const history = await db.CoachMessageHistory.create({
        user_id,
        coach_intent,
        coach_need_family,
        context_transition_key,
        source_record_id,
        source_trigger_ref,
        sent_at: new Date(),
        status: "sent",
        prompt_version,
        model_version,
      });

      logger.info("Recorded sent message in history", {
        user_id,
        coach_intent,
        history_id: history._id,
      });

      return history;
    } catch (error) {
      logger.error("Failed to record sent message", { error, user_id });
      throw error;
    }
  }

  /**
   * Record a failed message (for retry tracking)
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async recordFailed(params) {
    const {
      user_id,
      coach_intent,
      coach_need_family,
      context_transition_key,
      source_trigger_ref,
    } = params;

    try {
      const history = await db.CoachMessageHistory.create({
        user_id,
        coach_intent,
        coach_need_family,
        context_transition_key,
        source_trigger_ref,
        sent_at: new Date(),
        status: "failed",
      });

      logger.info("Recorded failed message in history", { user_id, coach_intent });
      return history;
    } catch (error) {
      logger.error("Failed to record failed message", { error, user_id });
      throw error;
    }
  }

  /**
   * Get recent message history for a user
   * @param {string} user_id
   * @param {number} monthsLookback - How far back to look (default 12)
   * @returns {Promise<Array>}
   */
  async getRecentHistory(user_id, monthsLookback = 12) {
    const lookbackDate = new Date();
    lookbackDate.setMonth(lookbackDate.getMonth() - monthsLookback);

    try {
      const records = await db.CoachMessageHistory.find({
        user_id,
        sent_at: { $gte: lookbackDate },
      })
        .sort({ sent_at: -1 })
        .limit(100);

      return records;
    } catch (error) {
      logger.error("Failed to get recent history", { error, user_id });
      throw error;
    }
  }

  /**
   * Cleanup old records (TTL is automatic, but this can be manual trigger)
   * @param {number} monthsThreshold - Delete records older than this (default 13)
   * @returns {Promise<Object>} { deletedCount }
   */
  async cleanupOldRecords(monthsThreshold = 13) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsThreshold);

    try {
      const result = await db.CoachMessageHistory.deleteMany({
        sent_at: { $lt: cutoffDate },
      });

      logger.info("Cleaned up old history records", {
        deletedCount: result.deletedCount,
        before: cutoffDate,
      });

      return { deletedCount: result.deletedCount };
    } catch (error) {
      logger.error("Cleanup failed", { error });
      throw error;
    }
  }
}

module.exports = new CoachDedupeService();
