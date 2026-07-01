#!/usr/bin/env node

/**
 * Migration Script: Add default type to funnelUrl documents
 * 
 * This script finds all funnelUrl documents that don't have a `type` field
 * and adds a default type value to them.
 * 
 * Usage:
 *   node migrations/add-type-to-funnelUrl.js
 * 
 * Or with a custom default type:
 *   node migrations/add-type-to-funnelUrl.js --type=owner_for_rent
 */

"use strict";

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const { PORT, DB_PORT, HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

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

// Parse command line arguments
const args = process.argv.slice(2);
let defaultType = "buyer";

for (const arg of args) {
  if (arg.startsWith("--type=")) {
    defaultType = arg.split("=")[1];
  }
}

// Validate defaultType against allowed enum values
const allowedTypes = ["owner_for_rent", "owner_for_seller", "seller", "buyer"];
if (!allowedTypes.includes(defaultType)) {
  console.error(`❌ Error: Invalid type "${defaultType}". Allowed values: ${allowedTypes.join(", ")}`);
  process.exit(1);
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
    type: { type: String, enum: allowedTypes },
    viewCount: Number,
    viewersId: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const FunnelUrl = mongoose.model("funnelUrl", funnelUrlSchema);

/**
 * Run the migration
 */
async function runMigration() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log(`   URL: ${mongoUrl.replace(/mongodb:\/\/.*@/, "mongodb://***@")}`);
    console.log(`   Database: ${DB_NAME}`);

    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Find documents without a type field or with null/undefined type
    console.log(`🔍 Searching for funnelUrl documents without a 'type' field...`);
    
    const query = {
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: "" },
      ],
    };

    const documentsToUpdate = await FunnelUrl.find(query);
    const countToUpdate = documentsToUpdate.length;

    console.log(`   Found: ${countToUpdate} documents\n`);

    if (countToUpdate === 0) {
      console.log("✅ No documents to update. Migration complete!");
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show sample documents
    console.log("📄 Sample documents to update:");
    documentsToUpdate.slice(0, 3).forEach((doc, index) => {
      console.log(`   ${index + 1}. ID: ${doc._id}, Title: ${doc.title || "N/A"}`);
    });
    if (countToUpdate > 3) {
      console.log(`   ... and ${countToUpdate - 3} more\n`);
    } else {
      console.log("");
    }

    // Perform the update
    console.log(`⏳ Updating ${countToUpdate} documents with type="${defaultType}"...`);
    
    const updateResult = await FunnelUrl.updateMany(query, { type: defaultType });

    console.log("\n✅ Migration completed successfully!\n");
    console.log("📊 Results:");
    console.log(`   ├─ Matched: ${updateResult.matchedCount}`);
    console.log(`   ├─ Modified: ${updateResult.modifiedCount}`);
    console.log(`   └─ Acknowledged: ${updateResult.acknowledged ? "Yes" : "No"}\n`);

    // Show a sample of updated documents
    console.log("🔍 Verification - Sample of updated documents:");
    const updatedSample = await FunnelUrl.find(query).limit(3);
    updatedSample.forEach((doc, index) => {
      console.log(`   ${index + 1}. ID: ${doc._id}, Type: ${doc.type}, Title: ${doc.title || "N/A"}`);
    });

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during migration:");
    console.error(`   ${error.message}\n`);
    
    if (error.name === "MongooseError" || error.name === "MongoError") {
      console.error("   Connection Error - Check your MongoDB connection settings");
    }
    
    console.error("Stack trace:", error);
    
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Run the migration
console.log("╔════════════════════════════════════════╗");
console.log("║   FunnelUrl Type Migration Script      ║");
console.log("╚════════════════════════════════════════╝\n");

console.log(`📝 Configuration:`);
console.log(`   ├─ Default Type: ${defaultType}`);
console.log(`   └─ Environment: ${process.env.NODE_ENV || "development"}\n`);

runMigration();
