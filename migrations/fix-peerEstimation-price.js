#!/usr/bin/env node
/**
 * Migration: Fix userReasonablePrice in peerEstimations
 *
 * Bug: userReasonablePrice was stored as price/m² instead of total price.
 * Fix: for each record where userReasonablePrice ≤ currentPricePerSqm * 1.5,
 *      recompute: surface = round(currentPropReferencePrice / currentPricePerSqm)
 *      corrected  = round(userReasonablePrice * surface)
 *
 * Usage:
 *   node migrations/fix-peerEstimation-price.js [--dry-run]
 */
"use strict";

const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { DB_PORT, HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!HOST || !DB_PORT || !DB_NAME) {
  console.error("❌ Missing required env vars (HOST, DB_PORT, DB_NAME)");
  process.exit(1);
}

const mongoUrl =
  DB_USER && DB_PASSWORD
    ? `mongodb://${DB_USER}:${DB_PASSWORD}@${HOST}:${DB_PORT}/${DB_NAME}`
    : `mongodb://${HOST}:${DB_PORT}/${DB_NAME}`;

const isDryRun = process.argv.includes("--dry-run");

const schema = new mongoose.Schema(
  {
    userReasonablePrice: Number,
    currentPropReferencePrice: Number,
    currentPricePerSqm: Number,
  },
  { strict: false, timestamps: true }
);
const PeerEstimation = mongoose.model("peerEstimations", schema);

async function run() {
  await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log(`✅ Connected to ${DB_NAME} (${isDryRun ? "DRY RUN" : "LIVE"})`);

  // Fetch all estimations that may have a buggy price
  const records = await PeerEstimation.find({
    currentPricePerSqm: { $gt: 0 },
    currentPropReferencePrice: { $gt: 0 },
  }).lean();

  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    const { _id, userReasonablePrice, currentPropReferencePrice, currentPricePerSqm } = rec;

    // Compute implied surface from stored reference data
    const impliedSurface = Math.round(currentPropReferencePrice / currentPricePerSqm);
    if (!impliedSurface || impliedSurface <= 0) { skipped++; continue; }

    // Heuristic: if userReasonablePrice looks like a per-sqm value
    // (i.e. it's in the same magnitude as currentPricePerSqm ±50%),
    // then it was stored wrong and needs to be multiplied by the surface.
    const isLikelyPerSqm =
      userReasonablePrice > 0 &&
      userReasonablePrice <= currentPricePerSqm * 1.5 &&
      userReasonablePrice >= currentPricePerSqm * 0.5;

    if (!isLikelyPerSqm) { skipped++; continue; }

    const correctedPrice = Math.round(userReasonablePrice * impliedSurface);

    console.log(
      `  [${_id}] surface≈${impliedSurface}m²  ` +
      `userReasonablePrice: ${userReasonablePrice} → ${correctedPrice}`
    );

    if (!isDryRun) {
      await PeerEstimation.updateOne({ _id }, { $set: { userReasonablePrice: correctedPrice } });
    }
    updated++;
  }

  console.log(`\n✅ Done. Updated: ${updated}, Skipped: ${skipped}`);
  if (isDryRun) console.log("  (dry-run — no changes written)");
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
