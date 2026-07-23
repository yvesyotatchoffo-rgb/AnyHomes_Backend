const express = require("express");
var cors = require("cors");
let http = require("http");
var bcrypt = require("bcrypt");

// ── Crash logger ──────────────────────────────────────────────────────────────
const CRASH_LOG = require("path").join(__dirname, "crash.log");
function writeCrashLog(type, err) {
  const entry = "\n[" + new Date().toISOString() + "] [" + type + "]\n" + (err && err.stack ? err.stack : String(err)) + "\n" + "─".repeat(80);
  try { require("fs").appendFileSync(CRASH_LOG, entry); } catch (_) {}
  console.error(entry);
}
process.on("uncaughtException",  function(err) { writeCrashLog("uncaughtException",  err); process.exit(1); });
process.on("unhandledRejection", function(err) {
  if (err?.name === 'PoolClearedOnNetworkError' || err?.message?.includes('interrupted due to server monitor timeout')) {
    console.warn('[Server] MongoDB connection interrupted — not crashing, will reconnect automatically');
    return;
  }
  writeCrashLog("unhandledRejection", err); process.exit(1);
});
// ─────────────────────────────────────────────────────────────────────────────



const app = express();
// CORS is configured below with credentials support for local frontend dev.


const corsOptions = {
  origin: (origin, callback) => {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    const allowedOrigins = [
      'http://127.0.0.1:8089',
      'http://localhost:8089',
      'https://127.0.0.1:8089',
      'https://localhost:8089',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'https://127.0.0.1:3000',
      'https://localhost:3000',
    ];

    const allowLocalHost = origin && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!origin || allowedOrigins.includes(origin) || allowLocalHost) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Guest-Mode'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // for preflight support

// ── Stripe Webhook (doit être AVANT express.json pour avoir le raw body) ────
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  require('./app/modules/services-marketplace/webhooks/stripeWebhook'),
);

app.use(express.json());
let socketService = require('./app/services/sockets')

app.use(express.urlencoded({ extended: true }));
//server static files

app.use(express.static("public"));


//Adding Middleware for authenticate request
app.use("/", require("./app/middleware/auth"));
app.use("/", require("./app/middleware/responseTimeMiddleware"));

const db = require("./app/models");

// initialize queue UI (bull-board) if redis available
try {
  const { router: bullBoardRouter, setQueues, BullMQAdapter } = require('bull-board');
  const { queue } = require('./app/queues/importQueue');

  if (queue) {
    setQueues([new BullMQAdapter(queue)]);
    app.use('/admin/queues', bullBoardRouter);
    console.log('Bull-board UI mounted at /admin/queues');
  } else {
    console.warn('BullMQ queue not available, bull-board not mounted');
  }
} catch (e) {
  console.warn('Bull-board not initialized:', e.message);
}

let routes = require("./app/routes");

const { resetDailyMessageLimit } = require("./app/cron/message.cron");
const { checkAndSendSubscriptionReminders } = require("./app/cron/subscription.cron");
const { monthlyCampaignLimit } = require("./app/cron/campaign.cron.js");
const { startWeeklyDigestCron } = require("./app/cron/weeklyDigest.cron");

// require('./app/routes/users.routes')(app);
// require('./app/routes/upload.routes')(app);
// require('./app/routes/category.routes')(app);
// require('./app/routes/roles.routes')(app);
// Middleware to append io instance to req
// app.use((req, res, next) => {
//     req.io = getSocketIo(); // Append io instance to req
//     next();
// });

const fs = require('fs');
// Quick request logger for marketplace pro service routes (help debug incoming requests)
app.use((req, res, next) => {
  try {
    if (req.originalUrl && req.originalUrl.startsWith('/pro/marketplace/services')) {
      const hasAuth = !!req.headers.authorization;
      const guestMode = req.headers['x-guest-mode'] || req.query.guest || false;
      const line = `${new Date().toISOString()} REQ ${req.method} ${req.originalUrl} auth=${hasAuth} x-guest-mode=${guestMode}\n`;
      console.log(line.trim());
      try { fs.appendFileSync('/tmp/pro_marketplace_requests.log', line); } catch (e) { /* ignore file errors */ }
    }
  } catch (e) { /* ignore logging errors */ }
  next();
});

db.mongoose.set("strictQuery", false);
db.mongoose
  .connect(db.url, {})
  .then(async () => {
    console.log("Connected to the database!");

    // start Agenda first, then load jobs so scheduling happens only after Agenda is ready
    try {
      const agenda = require("./app/config/agenda.config");
      try {
        await agenda.start();
        try {
          require("./app/jobs/agenda.jobs")(agenda, db);
          console.log("Agenda started and jobs loaded.");
        } catch (e) {
          console.error('Failed to load agenda jobs:', e);
        }
      } catch (e) {
        console.error('Agenda failed to start, continuing without scheduled jobs:', e);
      }
    } catch (e) {
      console.error('Agenda configuration not available, skipping job scheduler:', e);
    }

    // Pre-warm caches asynchronously — non-blocking, errors are logged only
    const prewarmCaches = async () => {
      try {
        const controller = require('./app/controllers/PropertyController');
        if (typeof controller.mapMarkers?.prewarm === 'function') {
          await Promise.all([
            controller.mapMarkers.prewarm(500),
            controller.mapMarkers.prewarm(2000),
          ]);
          console.log('[Prewarm] map-markers cache warmed (500 + 2000)');
        }
      } catch (e) {
        console.warn('[Prewarm] map-markers cache error:', e.message);
      }

      // Pre-warm property_stats total count (ensures the first visitor gets a cached value)
      try {
        const statsService = require('./app/services/propertyStats.service');
        const total = await statsService.getTotal();
        if (total === null) {
          statsService.reconcileAll().catch(e =>
            console.warn('[Prewarm] stats rebuild error:', e.message)
          );
        } else {
          console.log(`[Prewarm] property_stats total = ${total.toLocaleString()}`);
        }
      } catch (e) {
        console.warn('[Prewarm] property_stats error:', e.message);
      }

      // Pre-warm property_coordinates if empty (for map markers)
      try {
        const coordService = require('./app/services/propertyCoordinates.service');
        const mongoose = require('mongoose');
        const count = await mongoose.connection.db.collection('property_coordinates').countDocuments();
        if (count === 0) {
          coordService.reconcileAll().catch(e =>
            console.warn('[Prewarm] coordinates rebuild error:', e.message)
          );
        } else {
          console.log(`[Prewarm] property_coordinates has ${count.toLocaleString()} entries`);
        }
      } catch (e) {
        console.warn('[Prewarm] property_coordinates error:', e.message);
      }
    };
    prewarmCaches();
  })
  .catch((err) => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to  Bookaroo" });
});

// Public referral link redirect — /r/:shareCode -> frontend signup?ref=...
app.get("/r/:shareCode", require("./app/controllers/ReferralController").trackLinkOpen);

app.use("/", routes);
// let rolesData = [
//   { name: "admin", loginPortal: "admin", permissions: [] },
//   { name: "user", loginPortal: "front", permissions: [] },
// ];

var usersData = {
  fullName: "Bookaroo",
  password: "123456789",
  email: "bookaroo_admin@yopmail.com",
  role: "admin",
  status: "active",
  isVerified: "Y",
};

const seedDb = async () => {
  // if ((await db.users.countUsers()) == 0) {
  //   await db.users.insertMany(rolesData);
  // }

  if ((await db.users.countDocuments()) == 0) {
    // let adminRole = await db.roles.findOne({ name: "Admin" });
    // if (adminRole) {
    // for await (let itm of usersData) {
    console.log(usersData.password);
    usersData.password = await bcrypt.hashSync(
      usersData.password,
      bcrypt.genSaltSync(10)
    );
    // itm["role"] = adminRole._id;

    await db.users.create(usersData);
    // }
    // }
  }
};
seedDb();

resetDailyMessageLimit();
checkAndSendSubscriptionReminders();
monthlyCampaignLimit();
startWeeklyDigestCron();

// ── Coach IA WebSocket Handler (Phase 2) ────
let coachWebSocketHandler = null;
try {
  if (process.env.COACH_WEBSOCKET_ENABLED !== 'false') {
    const CoachWebSocketHandler = require('./app/websocket/coach.websocket');
    coachWebSocketHandler = new CoachWebSocketHandler(null, {
      jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-prod',
    });
    console.log('Coach WebSocket handler prepared (will be initialized after HTTP server)');
  }
} catch (e) {
  console.warn('Coach WebSocket handler failed to prepare:', e.message);
}

// set port, listen for requests
const PORT = process.env.PORT || 6089;

let startServer = http.createServer(app);

// Initialize Coach WebSocket after HTTP server is created
if (coachWebSocketHandler) {
  coachWebSocketHandler.server = startServer;
  coachWebSocketHandler.setupHandlers();
  coachWebSocketHandler.startHeartbeat();
  console.log('Coach WebSocket handler initialized on /coach/ws');
}

socketService.initializeSocket(startServer)
startServer.listen(PORT, function () {
  console.log(`Server is running on port ${PORT}.`);
});

// Make coach WebSocket handler available globally for broadcast calls
global.coachWebSocketHandler = coachWebSocketHandler;

module.exports = app;
