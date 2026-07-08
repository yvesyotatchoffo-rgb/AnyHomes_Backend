#!/usr/bin/env node

/**
 * Seed Coach Trigger Definitions
 * Initialize 17 trigger definitions in MongoDB
 *
 * Usage: node scripts/seed_coach_triggers.js
 */

const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config.js");
const { COACH_TRIGGER_REGISTRY } = require("../app/constants/coachConstants");

const db = {};

// Initialize Mongoose
async function seedTriggers() {
  try {
    console.log("🌱 Seeding Coach Trigger Definitions...");

    await mongoose.connect(dbConfig.url);
    console.log("✅ Connected to MongoDB");

    // Require models
    const CoachTriggerDefinition = require("../app/models/coachTriggerDefinition.model.js")(mongoose);

    // Clear existing triggers (optional)
    const existingCount = await CoachTriggerDefinition.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing triggers. Removing...`);
      await CoachTriggerDefinition.deleteMany({});
      console.log("✅ Cleared existing triggers");
    }

    // Insert 17 triggers
    const result = await CoachTriggerDefinition.insertMany(COACH_TRIGGER_REGISTRY);
    console.log(`✅ Seeded ${result.length} trigger definitions`);

    // Verify
    const inserted = await CoachTriggerDefinition.find({});
    console.log("\n📋 Inserted triggers:");
    inserted.forEach((trigger) => {
      console.log(
        `  - ${trigger.trigger_ref}: ${trigger.coach_intent} (${trigger.transaction_type})`
      );
    });

    console.log("\n✨ Seeding complete!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error.message);
    process.exit(1);
  }
}

seedTriggers();
