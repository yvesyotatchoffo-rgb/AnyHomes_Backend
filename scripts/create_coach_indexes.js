#!/usr/bin/env node

/**
 * Create Coach IA MongoDB Indexes
 * Performance optimization for deduplication and querying
 *
 * Usage: node scripts/create_coach_indexes.js
 */

const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config.js");

async function createIndexes() {
  try {
    console.log("📇 Creating Coach IA indexes...");

    await mongoose.connect(dbConfig.url);
    console.log("✅ Connected to MongoDB");

    // Require models
    const CoachTriggerDefinition = require("../app/models/coachTriggerDefinition.model.js")(
      mongoose
    );
    const CoachMessageRequest = require("../app/models/coachMessageRequest.model.js")(mongoose);
    const CoachMessageRecord = require("../app/models/coachMessageRecord.model.js")(mongoose);
    const CoachMessageHistory = require("../app/models/coachMessageHistory.model.js")(mongoose);

    // Create indexes for CoachTriggerDefinition
    console.log("\n📍 Creating CoachTriggerDefinition indexes...");
    await CoachTriggerDefinition.collection.createIndex({ trigger_ref: 1 });
    await CoachTriggerDefinition.collection.createIndex({
      coach_intent: 1,
      active: 1,
    });
    await CoachTriggerDefinition.collection.createIndex({
      transaction_type: 1,
      message_coach_ia: 1,
    });
    console.log("✅ Created 3 indexes for CoachTriggerDefinition");

    // Create indexes for CoachMessageRequest
    console.log("\n📍 Creating CoachMessageRequest indexes...");
    await CoachMessageRequest.collection.createIndex({ event_id: 1 });
    await CoachMessageRequest.collection.createIndex({
      user_id: 1,
      created_at: -1,
    });
    await CoachMessageRequest.collection.createIndex({
      status: 1,
      created_at: -1,
    });
    console.log("✅ Created 3 indexes for CoachMessageRequest");

    // Create indexes for CoachMessageRecord
    console.log("\n📍 Creating CoachMessageRecord indexes...");
    await CoachMessageRecord.collection.createIndex({
      user_id: 1,
      sent_at: -1,
    });
    await CoachMessageRecord.collection.createIndex({
      user_id: 1,
      coach_intent: 1,
      sent_at: -1,
    });
    await CoachMessageRecord.collection.createIndex({
      user_id: 1,
      coach_need_family: 1,
      sent_at: -1,
    });
    await CoachMessageRecord.collection.createIndex({
      property_id: 1,
      sent_at: -1,
    });
    await CoachMessageRecord.collection.createIndex({
      status: 1,
      created_at: -1,
    });
    await CoachMessageRecord.collection.createIndex({ request_id: 1 });
    console.log("✅ Created 6 indexes for CoachMessageRecord");

    // Create indexes for CoachMessageHistory (with TTL)
    console.log("\n📍 Creating CoachMessageHistory indexes...");
    await CoachMessageHistory.collection.createIndex({
      sent_at: 1,
    }, { expireAfterSeconds: 40886400 }); // 13 months ≈ 474 days
    await CoachMessageHistory.collection.createIndex({
      user_id: 1,
      coach_intent: 1,
      sent_at: -1,
    });
    await CoachMessageHistory.collection.createIndex({
      user_id: 1,
      coach_need_family: 1,
      sent_at: -1,
    });
    await CoachMessageHistory.collection.createIndex({
      user_id: 1,
      coach_need_family: 1,
      context_transition_key: 1,
      sent_at: -1,
    });
    console.log("✅ Created 4 indexes for CoachMessageHistory (including TTL)");

    // List all indexes
    console.log("\n📊 Index Summary:");
    const indexes = await Promise.all([
      CoachTriggerDefinition.collection.getIndexes(),
      CoachMessageRequest.collection.getIndexes(),
      CoachMessageRecord.collection.getIndexes(),
      CoachMessageHistory.collection.getIndexes(),
    ]);

    console.log(
      `  - CoachTriggerDefinition: ${Object.keys(indexes[0]).length} indexes`
    );
    console.log(`  - CoachMessageRequest: ${Object.keys(indexes[1]).length} indexes`);
    console.log(`  - CoachMessageRecord: ${Object.keys(indexes[2]).length} indexes`);
    console.log(`  - CoachMessageHistory: ${Object.keys(indexes[3]).length} indexes`);

    console.log("\n✨ All indexes created successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Index creation failed:", error.message);
    process.exit(1);
  }
}

createIndexes();
