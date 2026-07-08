/**
 * Coach Logger Utility
 * Structured logging for Coach IA system
 */

class CoachLogger {
  constructor(module) {
    this.module = module;
    this.env = process.env.NODE_ENV || "development";
    this.logLevel = process.env.LOG_LEVEL || "info";
  }

  /**
   * Log an error
   */
  error(message, data = {}) {
    this._log("ERROR", message, data);
  }

  /**
   * Log a warning
   */
  warn(message, data = {}) {
    this._log("WARN", message, data);
  }

  /**
   * Log info
   */
  info(message, data = {}) {
    this._log("INFO", message, data);
  }

  /**
   * Log debug
   */
  debug(message, data = {}) {
    if (this.env === "development") {
      this._log("DEBUG", message, data);
    }
  }

  /**
   * Internal logging
   * @private
   */
  _log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      ...data,
    };

    // In development, use console.log for readability
    if (this.env === "development") {
      console.log(JSON.stringify(logEntry, null, 2));
    } else {
      // In production, output JSON for aggregation
      console.log(JSON.stringify(logEntry));
    }

    // Could also send to external logging service here
    // Example: Datadog, Sentry, LogRocket, etc.
  }
}

module.exports = CoachLogger;
