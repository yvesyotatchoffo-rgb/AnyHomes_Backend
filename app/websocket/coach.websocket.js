/**
 * Coach WebSocket Handler
 * Real-time message delivery for Coach IA (Phase 2)
 * 
 * Features:
 * - Full duplex communication between client and server
 * - JWT token verification on connection
 * - Per-user message broadcasting
 * - Connection pooling with userConnections map
 * - Auto-reconnection support with heartbeat
 * - Error handling & graceful degradation
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Logger = require('../utils/coachLogger');

const logger = new Logger('CoachWebSocketHandler');

class CoachWebSocketHandler {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-prod',
      heartbeatInterval: options.heartbeatInterval || 30000, // 30s
      maxConnectAttempts: options.maxConnectAttempts || 3,
      ...options,
    };

    // Store user connections: { userId: [{ ws, connectionId, connectedAt, messageQueue }] }
    this.userConnections = new Map();

    // Global connection stats
    this.stats = {
      totalConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      broadcastsSucceeded: 0,
      broadcastsFailed: 0,
      startedAt: new Date(),
    };

    // Create WebSocket server
    this.wss = new WebSocket.Server({ server, path: '/coach/ws' });

    this.setupHandlers();
    this.startHeartbeat();

    logger.info('CoachWebSocketHandler initialized', {
      path: '/coach/ws',
      heartbeatInterval: this.options.heartbeatInterval,
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  setupHandlers() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    try {
      // Parse URL query parameters for userId and token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const userId = url.searchParams.get('userId');
      const token = url.searchParams.get('token');

      // Verify JWT token
      if (!token || !userId) {
        ws.close(4001, 'Missing userId or token');
        logger.warn('Connection rejected: missing credentials', { userId });
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, this.options.jwtSecret);
      } catch (error) {
        ws.close(4002, 'Invalid token');
        logger.warn('Connection rejected: invalid token', { userId, error: error.message });
        return;
      }

      // Verify token matches userId
      if (decoded.id !== userId && decoded._id !== userId) {
        ws.close(4003, 'Token mismatch');
        logger.warn('Connection rejected: token/userId mismatch', { userId, tokenUserId: decoded.id });
        return;
      }

      // Generate connection ID
      const connectionId = `ws_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

      // Create connection object
      const connection = {
        ws,
        userId,
        connectionId,
        connectedAt: new Date(),
        messageQueue: [],
        isAlive: true,
      };

      // Register connection
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, []);
      }
      this.userConnections.get(userId).push(connection);

      this.stats.totalConnections++;

      logger.info('WebSocket connected', {
        userId,
        connectionId,
        totalUserConnections: this.userConnections.get(userId).length,
      });

      // Send welcome message
      this.sendToConnection(connection, {
        type: 'connected',
        connectionId,
        timestamp: new Date(),
        queuedMessages: connection.messageQueue.length,
      });

      // Flush any queued messages
      this.flushMessageQueue(connection);

      // Setup connection event handlers
      ws.on('message', (data) => {
        this.handleMessage(userId, data, ws, connection);
      });

      ws.on('pong', () => {
        connection.isAlive = true;
      });

      ws.on('close', () => {
        this.handleClose(userId, connection);
      });

      ws.on('error', (error) => {
        this.handleError(userId, connection, error);
      });
    } catch (error) {
      logger.error('Connection handler failed', { error: error.message });
      ws.close(5000, 'Server error');
    }
  }

  /**
   * Handle incoming message from client
   */
  async handleMessage(userId, data, ws, connection) {
    try {
      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
        return;
      }

      this.stats.messagesReceived++;

      const { type, payload = {} } = message;

      logger.debug('Message received', {
        userId,
        connectionId: connection.connectionId,
        type,
      });

      // Route message by type
      switch (type) {
        case 'get_latest_message':
          await this.handleGetLatestMessage(userId, payload, connection);
          break;

        case 'get_message_history':
          await this.handleGetMessageHistory(userId, payload, connection);
          break;

        case 'send_feedback':
          await this.handleSendFeedback(userId, payload, connection);
          break;

        case 'ping':
          this.sendToConnection(connection, { type: 'pong', timestamp: new Date() });
          break;

        default:
          logger.warn('Unknown message type', { userId, type });
          ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
      }
    } catch (error) {
      logger.error('Message handler error', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Handle get_latest_message request
   */
  async handleGetLatestMessage(userId, payload, connection) {
    try {
      const db = require('../models');
      const { propertyId } = payload;

      // Query latest message for user (and optionally filter by property)
      const query = { user_id: userId, status: 'sent' };
      if (propertyId) {
        query.property_id = propertyId;
      }

      const message = await db.CoachMessageRecord.findOne(query)
        .sort({ sent_at: -1 })
        .lean();

      if (message) {
        this.sendToConnection(connection, {
          type: 'message',
          data: {
            id: message._id,
            title: message.output_json?.title,
            intro: message.output_json?.intro,
            advice_points: message.output_json?.advice_points || [],
            next_action: message.output_json?.next_action,
            resource: message.output_json?.resource,
            sentiment: message.output_json?.sentiment,
            coach_intent: message.coach_intent,
            coach_need_family: message.coach_need_family,
            sent_at: message.sent_at,
          },
          timestamp: new Date(),
        });

        logger.debug('Latest message sent', {
          userId,
          messageId: message._id,
          connectionId: connection.connectionId,
        });
      } else {
        this.sendToConnection(connection, {
          type: 'no_message',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      logger.error('get_latest_message failed', { userId, error: error.message });
      this.sendToConnection(connection, {
        type: 'error',
        error: 'Failed to fetch latest message',
      });
    }
  }

  /**
   * Handle get_message_history request
   */
  async handleGetMessageHistory(userId, payload, connection) {
    try {
      const db = require('../models');
      const {
        coach_need_family,
        months = 12,
        limit = 20,
      } = payload;

      const query = { user_id: userId, status: 'sent' };

      if (coach_need_family) {
        query.coach_need_family = coach_need_family;
      }

      // Date range
      const lookbackDate = new Date();
      lookbackDate.setMonth(lookbackDate.getMonth() - months);
      query.sent_at = { $gte: lookbackDate };

      const messages = await db.CoachMessageRecord.find(query)
        .sort({ sent_at: -1 })
        .limit(Math.min(limit, 100))
        .lean();

      this.sendToConnection(connection, {
        type: 'message_history',
        data: messages.map((msg) => ({
          id: msg._id,
          title: msg.output_json?.title,
          coach_intent: msg.coach_intent,
          coach_need_family: msg.coach_need_family,
          sent_at: msg.sent_at,
          feedback_type: msg.feedback_type,
        })),
        count: messages.length,
        timestamp: new Date(),
      });

      logger.debug('Message history sent', {
        userId,
        count: messages.length,
        connectionId: connection.connectionId,
      });
    } catch (error) {
      logger.error('get_message_history failed', {
        userId,
        error: error.message,
      });
      this.sendToConnection(connection, {
        type: 'error',
        error: 'Failed to fetch message history',
      });
    }
  }

  /**
   * Handle send_feedback request
   */
  async handleSendFeedback(userId, payload, connection) {
    try {
      const db = require('../models');
      const { messageId, feedbackType } = payload;

      // Validate feedback type
      if (!['helpful', 'not_helpful'].includes(feedbackType)) {
        this.sendToConnection(connection, {
          type: 'error',
          error: 'Invalid feedback type',
        });
        return;
      }

      // Update message record with feedback
      const updated = await db.CoachMessageRecord.findByIdAndUpdate(
        messageId,
        {
          feedback_type: feedbackType,
          feedback_at: new Date(),
        },
        { new: true }
      );

      if (!updated) {
        this.sendToConnection(connection, {
          type: 'error',
          error: 'Message not found',
        });
        return;
      }

      this.sendToConnection(connection, {
        type: 'feedback_received',
        messageId,
        feedbackType,
        timestamp: new Date(),
      });

      logger.info('Feedback recorded', {
        userId,
        messageId,
        feedbackType,
      });
    } catch (error) {
      logger.error('send_feedback failed', { userId, error: error.message });
      this.sendToConnection(connection, {
        type: 'error',
        error: 'Failed to record feedback',
      });
    }
  }

  /**
   * Handle WebSocket close
   */
  handleClose(userId, connection) {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      const index = userConnections.indexOf(connection);
      if (index > -1) {
        userConnections.splice(index, 1);
      }

      if (userConnections.length === 0) {
        this.userConnections.delete(userId);
      }
    }

    logger.info('WebSocket closed', {
      userId,
      connectionId: connection.connectionId,
      remainingConnections: this.userConnections.get(userId)?.length || 0,
    });
  }

  /**
   * Handle WebSocket error
   */
  handleError(userId, connection, error) {
    logger.error('WebSocket error', {
      userId,
      connectionId: connection.connectionId,
      error: error.message,
    });
  }

  /**
   * Broadcast message to specific user (all their connections)
   */
  broadcastToUser(userId, messageData) {
    try {
      const userConnections = this.userConnections.get(userId);

      if (!userConnections || userConnections.length === 0) {
        logger.debug('No active connections for user', { userId });
        return { sent: 0, queued: 0 };
      }

      let sent = 0;
      let queued = 0;

      for (const connection of userConnections) {
        if (this.sendToConnection(connection, messageData)) {
          sent++;
        } else {
          queued++;
        }
      }

      this.stats.messagesSent += sent;
      this.stats.broadcastsSucceeded++;

      logger.info('Message broadcast to user', {
        userId,
        sent,
        queued,
        totalConnections: userConnections.length,
      });

      return { sent, queued };
    } catch (error) {
      this.stats.broadcastsFailed++;
      logger.error('Broadcast to user failed', { userId, error: error.message });
      return { sent: 0, queued: 0, error: error.message };
    }
  }

  /**
   * Broadcast message to all connected users
   */
  broadcastToAll(messageData) {
    try {
      let totalSent = 0;
      let totalQueued = 0;

      for (const [userId, connections] of this.userConnections.entries()) {
        let sent = 0;
        let queued = 0;

        for (const connection of connections) {
          if (this.sendToConnection(connection, messageData)) {
            sent++;
          } else {
            queued++;
          }
        }

        totalSent += sent;
        totalQueued += queued;
      }

      this.stats.messagesSent += totalSent;
      this.stats.broadcastsSucceeded++;

      logger.info('Message broadcast to all', {
        totalConnections: this.userConnections.size,
        sent: totalSent,
        queued: totalQueued,
      });

      return { sent: totalSent, queued: totalQueued };
    } catch (error) {
      this.stats.broadcastsFailed++;
      logger.error('Broadcast to all failed', { error: error.message });
      return { sent: 0, queued: 0, error: error.message };
    }
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connection, data) {
    try {
      const payload = JSON.stringify({
        ...data,
        connectionId: connection.connectionId,
      });

      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(payload);
        return true;
      } else {
        // Queue message if connection not open
        connection.messageQueue.push(data);
        return false;
      }
    } catch (error) {
      logger.error('Send to connection failed', {
        connectionId: connection.connectionId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Flush queued messages when connection opens
   */
  flushMessageQueue(connection) {
    try {
      while (connection.messageQueue.length > 0 && connection.ws.readyState === WebSocket.OPEN) {
        const message = connection.messageQueue.shift();
        this.sendToConnection(connection, message);
      }
    } catch (error) {
      logger.error('Failed to flush message queue', {
        connectionId: connection.connectionId,
        error: error.message,
      });
    }
  }

  /**
   * Heartbeat: ping all connections periodically
   */
  startHeartbeat() {
    setInterval(() => {
      try {
        let activeConnections = 0;

        for (const [userId, connections] of this.userConnections.entries()) {
          for (const connection of connections) {
            if (connection.ws.readyState === WebSocket.OPEN) {
              connection.isAlive = false;
              connection.ws.ping();
              activeConnections++;
            }
          }
        }

        logger.debug('Heartbeat sent', { activeConnections });
      } catch (error) {
        logger.error('Heartbeat error', { error: error.message });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const now = new Date();
    const uptime = now - this.stats.startedAt;

    return {
      ...this.stats,
      activeUsers: this.userConnections.size,
      uptime,
      upTimeMinutes: Math.round(uptime / 60000),
      timestamp: now,
    };
  }

  /**
   * Get user's active connections count
   */
  getUserConnectionCount(userId) {
    return this.userConnections.get(userId)?.length || 0;
  }

  /**
   * Cleanup: close all connections
   */
  shutdown() {
    logger.info('Shutting down WebSocket handler', { stats: this.stats });

    for (const [userId, connections] of this.userConnections.entries()) {
      for (const connection of connections) {
        try {
          connection.ws.close(1000, 'Server shutting down');
        } catch (e) {
          logger.error('Error closing connection', { userId, error: e.message });
        }
      }
    }

    this.wss.close();
  }
}

module.exports = CoachWebSocketHandler;
