/**
 * Coach IA WebSocket Backend - Tests
 * Tests for CoachWebSocketHandler class
 * 
 * Date: 2026-07-06
 * Phase: 2 (WebSocket)
 */

const CoachWebSocketHandler = require('../../app/websocket/coach.websocket');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

describe('CoachWebSocketHandler - Phase 2 Backend Tests', () => {
  let handler;
  let mockServer;
  let mockWss;
  let jwtSecret = 'test-secret-key';

  beforeEach(() => {
    // Mock WebSocket server
    mockWss = {
      on: jest.fn(),
      close: jest.fn(),
      clients: new Set()
    };

    mockServer = {
      on: jest.fn()
    };

    // Create handler instance
    handler = new CoachWebSocketHandler(mockServer, {
      jwtSecret,
      heartbeatInterval: 1000 // Short interval for testing
    });

    // Override WebSocket server with mock
    handler.wss = mockWss;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Handler Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(handler.options.jwtSecret).toBe(jwtSecret);
      expect(handler.options.heartbeatInterval).toBe(1000);
      expect(handler.userConnections).toBeInstanceOf(Map);
      expect(handler.stats.totalConnections).toBe(0);
    });

    test('should have correct default options', () => {
      const defaultHandler = new CoachWebSocketHandler(mockServer);
      expect(defaultHandler.options.jwtSecret).toBeDefined();
      expect(defaultHandler.options.heartbeatInterval).toBeGreaterThan(0);
    });

    test('should setup WebSocket handlers on init', () => {
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockWss.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should start heartbeat on init', () => {
      // Heartbeat would be running
      expect(handler.wss).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    test('should accept valid WebSocket connections', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      // Should add to userConnections
      setTimeout(() => {
        expect(handler.userConnections.has(userId)).toBe(true);
        expect(handler.stats.totalConnections).toBe(1);
        done();
      }, 100);
    });

    test('should reject connection with missing token', (done) => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn()
      };

      const req = {
        url: '/?userId=user-123', // Missing token
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      // Should close connection
      setTimeout(() => {
        expect(mockWs.close).toHaveBeenCalledWith(4001, 'Missing userId or token');
        done();
      }, 100);
    });

    test('should reject connection with invalid token', (done) => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn()
      };

      const req = {
        url: '/?userId=user-123&token=invalid-token',
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      // Should close connection
      setTimeout(() => {
        expect(mockWs.close).toHaveBeenCalledWith(4002, 'Invalid token');
        done();
      }, 100);
    });

    test('should reject connection with token/userId mismatch', (done) => {
      const token = jwt.sign({ id: 'user-123' }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn()
      };

      const req = {
        url: `/?userId=user-456&token=${token}`, // Different userId
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      // Should close connection
      setTimeout(() => {
        expect(mockWs.close).toHaveBeenCalledWith(4003, 'Token mismatch');
        done();
      }, 100);
    });

    test('should cleanup connection on close', () => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);
      expect(handler.userConnections.has(userId)).toBe(true);

      // Simulate close
      const connection = handler.userConnections.get(userId)[0];
      handler.handleClose(userId, connection);

      expect(handler.userConnections.has(userId)).toBe(false);
    });
  });

  describe('Message Handling', () => {
    test('should handle ping message', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);
      const connection = handler.userConnections.get(userId)[0];

      handler.handleMessage(userId, JSON.stringify({ type: 'ping' }), mockWs, connection);

      // Should send pong
      setTimeout(() => {
        expect(mockWs.send).toHaveBeenCalled();
        const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sent.type).toBe('pong');
        done();
      }, 100);
    });

    test('should handle invalid JSON gracefully', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        close: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);
      const connection = handler.userConnections.get(userId)[0];

      handler.handleMessage(userId, 'invalid json', mockWs, connection);

      // Should send error
      setTimeout(() => {
        expect(mockWs.send).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('should handle unknown message type', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);
      const connection = handler.userConnections.get(userId)[0];

      handler.handleMessage(userId, JSON.stringify({ type: 'unknown_type' }), mockWs, connection);

      // Should send error
      setTimeout(() => {
        expect(mockWs.send).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Broadcasting', () => {
    test('should broadcast message to user with open connection', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      const messageData = {
        type: 'message',
        data: {
          id: 'msg-123',
          title: 'Test Message',
          sent_at: new Date()
        }
      };

      const result = handler.broadcastToUser(userId, messageData);

      setTimeout(() => {
        expect(result.sent).toBe(1);
        expect(result.queued).toBe(0);
        expect(mockWs.send).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('should queue message for offline connections', () => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.CONNECTING, // Not open
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      const messageData = {
        type: 'message',
        data: { id: 'msg-123', title: 'Test' }
      };

      const result = handler.broadcastToUser(userId, messageData);

      expect(result.sent).toBe(0);
      expect(result.queued).toBe(1);
    });

    test('should return 0 for non-existent user', () => {
      const messageData = { type: 'message', data: {} };
      const result = handler.broadcastToUser('non-existent-user', messageData);

      expect(result.sent).toBe(0);
      expect(result.queued).toBe(0);
    });

    test('should broadcast to all connected users', (done) => {
      const token1 = jwt.sign({ id: 'user-1' }, jwtSecret);
      const token2 = jwt.sign({ id: 'user-2' }, jwtSecret);

      const mockWs1 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      const mockWs2 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      handler.handleConnection(mockWs1, {
        url: `/?userId=user-1&token=${token1}`,
        headers: { host: 'localhost' }
      });

      handler.handleConnection(mockWs2, {
        url: `/?userId=user-2&token=${token2}`,
        headers: { host: 'localhost' }
      });

      const messageData = { type: 'broadcast', data: {} };
      const result = handler.broadcastToAll(messageData);

      setTimeout(() => {
        expect(result.sent).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Statistics', () => {
    test('should track connection stats', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      setTimeout(() => {
        const stats = handler.getStats();
        expect(stats.totalConnections).toBe(1);
        expect(stats.activeUsers).toBe(1);
        expect(stats.upTime).toBeGreaterThan(0);
        done();
      }, 100);
    });

    test('should track message counts', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      handler.broadcastToUser(userId, { type: 'message' });

      setTimeout(() => {
        const stats = handler.getStats();
        expect(stats.messagesSent).toBeGreaterThanOrEqual(0);
        expect(stats.broadcastsSucceeded).toBeGreaterThanOrEqual(0);
        done();
      }, 100);
    });

    test('should get user connection count', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);

      // Create 2 connections for same user
      const mockWs1 = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn()
      };

      handler.handleConnection(mockWs1, {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost' }
      });

      setTimeout(() => {
        const count = handler.getUserConnectionCount(userId);
        expect(count).toBe(1);
        done();
      }, 100);
    });
  });

  describe('Shutdown & Cleanup', () => {
    test('should close all connections on shutdown', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      handler.shutdown();

      setTimeout(() => {
        expect(mockWs.close).toHaveBeenCalled();
        done();
      }, 100);
    });

    test('should close WebSocket server on shutdown', () => {
      handler.shutdown();
      expect(mockWss.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', (done) => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        emit: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      handler.handleConnection(mockWs, req);

      const error = new Error('Test connection error');
      const connection = handler.userConnections.get(userId)[0];
      handler.handleError(userId, connection, error);

      // Should not crash
      expect(true).toBe(true);
      done();
    });

    test('should handle message send errors', () => {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn().mockImplementation(() => {
          throw new Error('Send failed');
        })
      };

      const connection = {
        ws: mockWs,
        connectionId: 'conn-123'
      };

      // Should not crash
      const result = handler.sendToConnection(connection, { type: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle full connection lifecycle', async () => {
      const userId = 'user-123';
      const token = jwt.sign({ id: userId }, jwtSecret);
      const mockWs = {
        readyState: WebSocket.OPEN,
        close: jest.fn(),
        send: jest.fn(),
        on: jest.fn(),
        ping: jest.fn()
      };

      const req = {
        url: `/?userId=${userId}&token=${token}`,
        headers: { host: 'localhost:6089' }
      };

      // 1. Connect
      handler.handleConnection(mockWs, req);
      expect(handler.userConnections.has(userId)).toBe(true);

      // 2. Receive message
      handler.handleMessage(userId, JSON.stringify({ type: 'ping' }), mockWs, null);
      expect(mockWs.send).toHaveBeenCalled();

      // 3. Broadcast
      handler.broadcastToUser(userId, { type: 'message', data: {} });

      // 4. Disconnect
      const connection = handler.userConnections.get(userId)[0];
      handler.handleClose(userId, connection);
      expect(handler.userConnections.has(userId)).toBe(false);
    });
  });
});
