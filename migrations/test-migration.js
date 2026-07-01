#!/usr/bin/env node

/**
 * Test/Dry-Run Script: Preview what the migration would do
 * 
 * This script shows what documents would be updated WITHOUT modifying them.
 * Use this to preview the migration before running the actual migration.
 * 
 * Usage:
 *   node migrations/test-migration.js
 *   node migrations/test-migration.js --type=owner_for_rent
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

// Parse command line arguments
const args = process.argv.slice(2);
let defaultType = "buyer";

for (const arg of args) {
  if (arg.startsWith("--type=")) {
    defaultType = arg.split("=")[1];
  }
}

// Validate defaultType
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
    createdAt: Date,
    updatedAt: Date,
  },
  { timestamps: true }
);

const FunnelUrl = mongoose.model("funnelUrl", funnelUrlSchema);

/**
 * Run the test
 */
async function runTest() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    console.log(`   URL: ${mongoUrl.replace(/mongodb:\/\/.*@/, "mongodb://***@")}`);

    await mongoose.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB\n");

    // Get collection statistics
    console.log("📊 Collection Statistics:");
    const total = await FunnelUrl.countDocuments();
    const withoutType = await FunnelUrl.countDocuments({
      $or: [{ type: { $exists: false } }, { type: null }, { type: "" }],
    });
    const withType = total - withoutType;

    console.log(`   ├─ Total documents: ${total}`);
    console.log(`   ├─ Without type: ${withoutType}`);
    console.log(`   └─ With type: ${withType}\n`);

    // Show current type distribution
    const counts = await FunnelUrl.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("📋 Current Type Distribution:");
    counts.forEach((c) => {
      console.log(`   ${(c._id || "null").padEnd(18)}: ${c.count}`);
    });
    console.log("");

    // Find documents that would be updated
    if (withoutType === 0) {
      console.log("✅ No documents to update!");
      console.log("   All funnelUrl documents already have a type field.\n");
    } else {
      const query = {
        $or: [{ type: { $exists: false } }, { type: null }, { type: "" }],
      };

      const documentsToUpdate = await FunnelUrl.find(query)
        .select("_id title type createdAt updatedAt")
        .limit(100);

      console.log(`🔍 Documents that WOULD be updated (showing up to 10):\n`);

      documentsToUpdate.slice(0, 10).forEach((doc, index) => {
        console.log(`   ${String(index + 1).padStart(2)}. ID: ${doc._id}`);
        console.log(
          `       Title: ${(doc.title || "N/A").substring(0, 50)}${doc.title?.length > 50 ? "..." : ""}`
        );
        console.log(`       Current Type: ${doc.type || "undefined"}`);
        console.log(`       NEW Type: ${defaultType}`);
        console.log(`       Created: ${doc.createdAt?.toISOString().split("T")[0] || "N/A"}`);
        console.log("");
      });

      if (documentsToUpdate.length > 10) {
        console.log(`   ... and ${documentsToUpdate.length - 10} more documents\n`);
      }

      console.log("📊 After Migration (Projected):");
      const newCounts = [...counts];
      const buyerEntry = newCounts.find((c) => c._id === defaultType);
      if (buyerEntry) {
        buyerEntry.count += withoutType;
      } else {
        newCounts.push({ _id: defaultType, count: withoutType });
      }
      newCounts.sort((a, b) => b.count - a.count);

      newCounts.forEach((c) => {
        console.log(`   ${(c._id || "null").padEnd(18)}: ${c.count}`);
      });
      console.log("");

      console.log("✨ To apply this migration, run:");
      console.log(`   node migrations/add-type-to-funnelUrl.js --type=${defaultType}\n`);
    }

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during test:");
    console.error(`   ${error.message}\n`);

    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    process.exit(1);
  }
}

// Run the test
console.log("╔════════════════════════════════════════╗");
console.log("║   FunnelUrl Type Migration DRY-RUN     ║");
console.log("╚════════════════════════════════════════╝\n");

console.log(`📝 Configuration:`);
console.log(`   Default Type: ${defaultType}`);
console.log(`   Mode: TEST (no changes will be made)\n`);

runTest();
