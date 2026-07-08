/**
 * Coach WebSocket Module
 * Real-time message delivery for Coach IA (Phase 2)
 */

const CoachWebSocketHandler = require('./coach.websocket');

module.exports = {
  CoachWebSocketHandler,
  // Factory for creating instances
  createHandler: (server, options) => new CoachWebSocketHandler(server, options),
};
