#!/usr/bin/env node

/**
 * Rollback Script: Remove type field from funnelUrl documents
 * 
 * This script reverts the migration by removing the type field from all documents
 * that were updated. Use this if you need to undo the migration.
 * 
 * Usage:
 *   node migrations/rollback-funnelUrl-type.js
 */

"use strict";

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const { DB_PORT, HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

// Validate required environment variables
if (!HOST || !DB_PORT || !DB_NAME) {
  console.error("❌ Error: Missing required environment variables (HOST, DB_PORT, DB_NAME)");
  process.exit(1);
}

// Build MongoDB connection URL
let mongoUrl;
if (DB_USER && DB_PASSWORD) {
  mongoUrl = `mongodb://${DB_USER}:${DB_PASSWORD}@${HOST}:${DB_PORT}/${DB_NAME}`;
} else {
  mongoUrl = `mongodb://${HOST}:${DB_PORT}/${DB_NAME}`;
}

// Define funnelUrl schema
const funnelUrlSchema = new mongoose.Schema(
  {
    topic: String,
    description: String,
    funnelStatus: String,
    youtubeUrl: String,
    duration: String,
    title: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    image: String,
    videoOwner: String,
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "tags" }],
    type: { type: String, enum: ["owner_for_rent", "owner_for_seller", "seller", "buyer"] },
    viewCount: Number,
    viewersId: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const FunnelUrl = mongoose.model("funnelUrl", funnelUrlSchema);

/**
 * Run the rollback
 */
async function rollback() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log(`   URL: ${mongoUrl.replace(/mongodb:\/\/.*@/, "mongodb://***@")}`);

    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Check how many documents have the type field
    console.log("🔍 Searching for funnelUrl documents with a 'type' field...");
    
    const docsWithType = await FunnelUrl.countDocuments({ type: { $exists: true } });
    console.log(`   Found: ${docsWithType} documents with type field\n`);

    if (docsWithType === 0) {
      console.log("✅ No documents with type field found. Rollback not needed!");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Perform the rollback
    console.log(`⏳ Removing type field from ${docsWithType} documents...`);
    
    const rollbackResult = await FunnelUrl.updateMany(
      { type: { $exists: true } },
      { $unset: { type: "" } }
    );

    console.log("\n✅ Rollback completed successfully!\n");
    console.log("📊 Results:");
    console.log(`   ├─ Matched: ${rollbackResult.matchedCount}`);
    console.log(`   ├─ Modified: ${rollbackResult.modifiedCount}`);
    console.log(`   └─ Acknowledged: ${rollbackResult.acknowledged ? "Yes" : "No"}\n`);

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during rollback:");
    console.error(`   ${error.message}\n`);
    
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Run the rollback
console.log("╔════════════════════════════════════════╗");
console.log("║   FunnelUrl Type Rollback Script       ║");
console.log("╚════════════════════════════════════════╝\n");

console.log("⚠️  This will REMOVE the type field from all funnelUrl documents\n");

rollback();
