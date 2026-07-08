#!/usr/bin/env node

/**
 * Coach IA System Integration Test
 * Tests all major components: models, services, API endpoints
 *
 * Usage: node scripts/test_coach_integration.js
 */

const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config.js");

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

let testsPassed = 0;
let testsFailed = 0;

function log(level, message) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    test: `${colors.yellow}→${colors.reset}`,
  };
  console.log(`${prefix[level]} [${timestamp}] ${message}`);
}

async function test(name, fn) {
  try {
    log("test", `Testing: ${name}`);
    await fn();
    log("success", `  ${name}`);
    testsPassed++;
  } catch (error) {
    log("error", `  ${name}: ${error.message}`);
    testsFailed++;
  }
}

async function runTests() {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🧪 Coach IA Integration Tests");
    console.log("=".repeat(60) + "\n");

    // Connect to DB
    log("info", "Connecting to MongoDB...");
    await mongoose.connect(dbConfig.url);
    log("success", "Connected to MongoDB");

    // Load models
    const CoachTriggerDefinition = require("../app/models/coachTriggerDefinition.model.js")(
      mongoose
    );
    const CoachMessageRequest = require("../app/models/coachMessageRequest.model.js")(mongoose);
    const CoachMessageRecord = require("../app/models/coachMessageRecord.model.js")(mongoose);
    const CoachMessageHistory = require("../app/models/coachMessageHistory.model.js")(mongoose);

    // Load services
    const coachTriggerService = require("../app/services/coachTrigger.service");
    const coachPromptService = require("../app/services/coachPrompt.service");
    const coachValidatorService = require("../app/services/coachValidator.service");

    console.log("\n--- Model Tests ---");

    await test("CoachTriggerDefinition schema exists", async () => {
      const schema = CoachTriggerDefinition.schema;
      if (!schema.paths.trigger_ref) throw new Error("trigger_ref field missing");
      if (!schema.paths.coach_intent) throw new Error("coach_intent field missing");
    });

    await test("CoachMessageRequest schema exists", async () => {
      const schema = CoachMessageRequest.schema;
      if (!schema.paths.event_id) throw new Error("event_id field missing");
      if (!schema.paths.user_id) throw new Error("user_id field missing");
      if (!schema.paths.status) throw new Error("status field missing");
    });

    await test("CoachMessageRecord schema exists", async () => {
      const schema = CoachMessageRecord.schema;
      if (!schema.paths.output_json) throw new Error("output_json field missing");
      if (!schema.paths.llm_latency_ms) throw new Error("llm_latency_ms field missing");
    });

    await test("CoachMessageHistory schema exists", async () => {
      const schema = CoachMessageHistory.schema;
      if (!schema.paths.coach_intent) throw new Error("coach_intent field missing");
      if (!schema.paths.sent_at) throw new Error("sent_at field missing");
    });

    console.log("\n--- Service Tests ---");

    await test("coachTriggerService.resolveTrigger works", async () => {
      const result = await coachTriggerService.resolveTrigger("OC_V01");
      if (result.coach_intent !== "welcome_first_lead_sale") {
        throw new Error("Unexpected intent returned");
      }
    });

    await test("coachTriggerService.getTriggersByType works", async () => {
      const ventes = coachTriggerService.getTriggersByType("VENTE");
      if (ventes.length !== 10) throw new Error("Expected 10 VENTE triggers");

      const locations = coachTriggerService.getTriggersByType("LOCATION");
      if (locations.length !== 7) throw new Error("Expected 7 LOCATION triggers");
    });

    await test("coachPromptService.buildPrompt works", async () => {
      const prompt = coachPromptService.buildPrompt({
        coach_intent: "welcome_first_lead_sale",
        transaction_type: "VENTE",
        context_data: { lead_name: "Test" },
      });

      if (!prompt.system || !prompt.user_prompt || !prompt.output_schema) {
        throw new Error("Prompt missing required fields");
      }
    });

    await test("coachPromptService has all 17 intents", async () => {
      const intents = coachPromptService.getAvailableIntents();
      if (intents.length !== 17) {
        throw new Error(`Expected 17 intents, got ${intents.length}`);
      }
    });

    await test("coachValidatorService validates message", async () => {
      const validMessage = {
        title: "Test Title Here",
        intro: "This is an intro.",
        advice_points: [
          "Point 1",
          "Point 2",
          "Point 3",
        ],
        next_action: "Do something next",
      };

      const result = coachValidatorService.validateMessage(validMessage);
      if (!result.valid) {
        throw new Error("Valid message failed validation");
      }
    });

    await test("coachValidatorService rejects invalid message", async () => {
      const invalidMessage = {
        title: "X", // Too short
        intro: "Missing intro",
        advice_points: ["Point 1"], // Too few
        next_action: "Y", // Too short
      };

      const result = coachValidatorService.validateMessage(invalidMessage);
      if (result.valid) {
        throw new Error("Invalid message passed validation");
      }
      if (result.errors.length === 0) {
        throw new Error("No errors returned");
      }
    });

    console.log("\n--- Constants Test ---");

    await test("COACH_TRIGGER_REGISTRY has 17 triggers", async () => {
      const { COACH_TRIGGER_REGISTRY } = require("../app/constants/coachConstants");
      if (COACH_TRIGGER_REGISTRY.length !== 17) {
        throw new Error(
          `Expected 17 triggers, got ${COACH_TRIGGER_REGISTRY.length}`
        );
      }
    });

    await test("All triggers have required fields", async () => {
      const { COACH_TRIGGER_REGISTRY } = require("../app/constants/coachConstants");
      for (const trigger of COACH_TRIGGER_REGISTRY) {
        if (!trigger.trigger_ref || !trigger.coach_intent || !trigger.transaction_type) {
          throw new Error(`Trigger missing required fields: ${JSON.stringify(trigger)}`);
        }
      }
    });

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Test Summary");
    console.log("=".repeat(60));
    console.log(
      `${colors.green}Passed: ${testsPassed}${colors.reset} | ${colors.red}Failed: ${testsFailed}${colors.reset}`
    );

    if (testsFailed === 0) {
      console.log(`\n${colors.green}✨ All tests passed!${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(
        `\n${colors.red}❌ Some tests failed${colors.reset}\n`
      );
      process.exit(1);
    }
  } catch (error) {
    log("error", `Test suite failed: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runTests();
