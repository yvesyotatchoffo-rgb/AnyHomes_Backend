/**
 * Coach Routes
 * REST API routes for Coach IA system
 */

const controller = require("../controllers/CoachController");
const router = require("express").Router();

// Event ingestion
router.post("/events/ingest", (req, res) => {
  controller.ingestEvent(req, res);
});

// Message planning
router.post("/messages/plan", (req, res) => {
  controller.planMessage(req, res);
});

// Message generation
router.post("/messages/generate", (req, res) => {
  controller.generateMessage(req, res);
});

// Message validation
router.post("/messages/validate", (req, res) => {
  controller.validateMessage(req, res);
});

// Message send
router.post("/messages/send", (req, res) => {
  controller.sendMessage(req, res);
});

// User question endpoint
router.post("/ask", (req, res) => {
  controller.askCoach(req, res);
});

// Get message history
router.get("/messages/history/:user_id", (req, res) => {
  controller.getMessageHistory(req, res);
});

// Get message status
router.get("/messages/status/:request_id", (req, res) => {
  controller.getMessageStatus(req, res);
});

// List available triggers
router.get("/triggers", (req, res) => {
  controller.listTriggers(req, res);
});

module.exports = router;
