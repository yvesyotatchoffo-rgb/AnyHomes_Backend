/**
 * Coach Validator Service
 * Validates LLM output against strict constraints and quality rules
 */

const { VALIDATION_CONSTRAINTS } = require("../constants/coachConstants");
const Logger = require("../utils/coachLogger");

const logger = new Logger("CoachValidatorService");

class CoachValidatorService {
  /**
   * Validate LLM output message
   * @param {Object} message - Generated message from LLM
   * @returns {Object} { valid: boolean, errors: [], warnings: [] }
   */
  validateMessage(message) {
    const errors = [];
    const warnings = [];

    if (!message || typeof message !== "object") {
      errors.push("Message must be a valid object");
      return { valid: false, errors, warnings };
    }

    // Validate required fields
    const titleError = this._validateField(message.title, "title");
    if (titleError) errors.push(titleError);

    const introError = this._validateField(message.intro, "intro");
    if (introError) errors.push(introError);

    const adviceError = this._validateField(
      message.advice_points,
      "advice_points"
    );
    if (adviceError) errors.push(adviceError);

    const nextActionError = this._validateField(message.next_action, "next_action");
    if (nextActionError) errors.push(nextActionError);

    // Validate optional field
    if (message.resource_cta) {
      const resourceError = this._validateField(message.resource_cta, "resource_cta");
      if (resourceError) warnings.push(resourceError);
    }

    // Quality checks
    const qualityIssues = this._checkQuality(message);
    warnings.push(...qualityIssues);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate individual field
   * @private
   */
  _validateField(value, fieldName) {
    const constraint = VALIDATION_CONSTRAINTS[fieldName];

    if (!constraint) {
      return null; // Unknown field, skip
    }

    // Check required
    if (constraint.required && !value) {
      return `${fieldName} is required`;
    }

    // If not required and empty, pass
    if (!constraint.required && !value) {
      return null;
    }

    // String validation
    if (typeof value === "string") {
      if (constraint.min_chars && value.length < constraint.min_chars) {
        return `${fieldName} must be at least ${constraint.min_chars} characters`;
      }
      if (constraint.max_chars && value.length > constraint.max_chars) {
        return `${fieldName} must be at most ${constraint.max_chars} characters`;
      }
      if (constraint.min_sentences) {
        const sentenceCount = (value.match(/[.!?]/g) || []).length;
        if (sentenceCount < constraint.min_sentences) {
          return `${fieldName} must have at least ${constraint.min_sentences} sentence(s)`;
        }
      }
      if (constraint.max_sentences) {
        const sentenceCount = (value.match(/[.!?]/g) || []).length;
        if (sentenceCount > constraint.max_sentences) {
          return `${fieldName} must have at most ${constraint.max_sentences} sentence(s)`;
        }
      }
    }

    // Array validation
    if (Array.isArray(value)) {
      if (constraint.min_items && value.length < constraint.min_items) {
        return `${fieldName} must have at least ${constraint.min_items} items`;
      }
      if (constraint.max_items && value.length > constraint.max_items) {
        return `${fieldName} must have at most ${constraint.max_items} items`;
      }
    }

    return null;
  }

  /**
   * Check for quality issues (warnings, not errors)
   * @private
   */
  _checkQuality(message) {
    const warnings = [];

    // Check for invention risk: too detailed specificity
    const textToAnalyze = [
      message.title,
      message.intro,
      message.next_action,
      ...(message.advice_points || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // Check for suspicious patterns
    if (this._hasInventionRisk(textToAnalyze)) {
      warnings.push(
        "invention_risk: Message contains unverified specific details (dates, numbers, names)"
      );
    }

    // Check for tone mismatch
    if (this._hasToneMismatch(textToAnalyze)) {
      warnings.push(
        "tone_mismatch: Message tone may not be professional/encouraging enough"
      );
    }

    // Check for duplicate points
    if (message.advice_points && this._hasDuplicates(message.advice_points)) {
      warnings.push("duplicate_risk: Some advice points may be repetitive");
    }

    return warnings;
  }

  /**
   * Detect invention risk
   * @private
   */
  _hasInventionRisk(text) {
    // Look for specific numbers, dates, percentages without context
    const inventionPatterns = [
      /\d{4}-\d{2}-\d{2}/, // Specific dates
      /\d{1,2}%/, // Percentages
      /\$\d+/, // Specific prices
      /€\d+/, // Euro prices
    ];

    return inventionPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Detect tone mismatch
   * @private
   */
  _hasToneMismatch(text) {
    // Look for negative or discouraging language
    const redFlags = [
      "impossible",
      "échec",
      "danger",
      "grave",
      "catastrophe",
    ];
    return redFlags.some((flag) => text.includes(flag));
  }

  /**
   * Detect duplicate advice points
   * @private
   */
  _hasDuplicates(points) {
    const normalized = points.map((p) =>
      p.toLowerCase().replace(/[.,!?]/g, "").trim()
    );
    return new Set(normalized).size < normalized.length;
  }

  /**
   * Get validation report
   * @param {Object} message
   * @returns {Object} { valid, score, issues, suggestions }
   */
  getValidationReport(message) {
    const validation = this.validateMessage(message);
    const issueCount = validation.errors.length + validation.warnings.length;
    const score = Math.max(0, 100 - issueCount * 10); // Rough scoring

    return {
      valid: validation.valid,
      score: Math.min(100, score),
      errors: validation.errors,
      warnings: validation.warnings,
      totalIssues: issueCount,
    };
  }
}

module.exports = new CoachValidatorService();
