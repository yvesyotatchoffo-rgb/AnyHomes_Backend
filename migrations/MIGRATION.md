# FunnelUrl Type Migration Guide

## Overview

These migration scripts help manage the `type` field for `funnelUrl` documents in MongoDB. The `type` field is used to categorize funnel URLs by user type: `owner_for_rent`, `owner_for_seller`, `seller`, or `buyer`.

**Location:** `migrations/` directory in the backend API

## Files

- **`add-type-to-funnelUrl.js`** - Main migration script to add default type to documents
- **`rollback-funnelUrl-type.js`** - Rollback script to remove the type field
- **`MIGRATION.md`** - This guide

## What the Migration Does

The migration script:
1. ✅ Connects to MongoDB using your `.env` configuration
2. 🔍 Finds all `funnelUrl` documents that either:
   - Don't have a `type` field
   - Have `null`, empty string, or `undefined` as the type value
3. 📝 Updates those documents with a default type value (default: `"buyer"`)
4. 📊 Shows a summary of matched and modified documents

## Prerequisites

Ensure the backend dependencies are installed:

```bash
cd /path/to/backend/api_bookaro-lovepreet
npm install
```

Verify your `.env` file contains these variables:

```env
HOST=localhost
DB_PORT=27017
DB_NAME=bookaro
# Optional (if your MongoDB requires authentication):
DB_USER=your_user
DB_PASSWORD=your_password
```

## How to Run

### 1. Run the Migration with Default Type ("buyer")

```bash
cd /path/to/backend/api_bookaro-lovepreet
node migrations/add-type-to-funnelUrl.js
```

**Expected Output:**
```
╔════════════════════════════════════════╗
║   FunnelUrl Type Migration Script      ║
╚════════════════════════════════════════╝

📝 Configuration:
   ├─ Default Type: buyer
   └─ Environment: development

🔄 Connecting to MongoDB...
   URL: mongodb://***@localhost:27017
   Database: bookaro
✅ Connected to MongoDB

🔍 Searching for funnelUrl documents without a 'type' field...
   Found: 42 documents

📄 Sample documents to update:
   1. ID: 507f1f77bcf86cd799439011, Title: How to Buy a Home
   2. ID: 507f1f77bcf86cd799439012, Title: Rental Guide
   3. ID: 507f1f77bcf86cd799439013, Title: Seller Checklist
   ... and 39 more

⏳ Updating 42 documents with type="buyer"...

✅ Migration completed successfully!

📊 Results:
   ├─ Matched: 42
   ├─ Modified: 42
   └─ Acknowledged: Yes

🔍 Verification - Sample of updated documents:
   1. ID: 507f1f77bcf86cd799439011, Type: buyer, Title: How to Buy a Home
   2. ID: 507f1f77bcf86cd799439012, Type: buyer, Title: Rental Guide
   3. ID: 507f1f77bcf86cd799439013, Type: buyer, Title: Seller Checklist

✅ Disconnected from MongoDB
```

### 2. Run with Custom Default Type

To use a different default type (one of: `owner_for_rent`, `owner_for_seller`, `seller`, `buyer`):

```bash
node migrations/add-type-to-funnelUrl.js --type=owner_for_rent
```

Valid type options:
- `buyer` (default)
- `seller`
- `owner_for_rent`
- `owner_for_seller`

### 3. Check Current Status (Query Only)

To see how many documents don't have a type without modifying anything:

```bash
cat > /tmp/check-types.js << 'EOF'
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const path = require("path");

dotenv.config({ path: ".env" });

const { DB_PORT, HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
let mongoUrl = DB_USER ? `mongodb://${DB_USER}:${DB_PASSWORD}@${HOST}:${DB_PORT}/${DB_NAME}` : `mongodb://${HOST}:${DB_PORT}/${DB_NAME}`;

const schema = new mongoose.Schema({}, { strict: false }, { timestamps: true });
const FunnelUrl = mongoose.model("funnelUrl", schema);

mongoose.connect(mongoUrl).then(async () => {
  const count = await FunnelUrl.countDocuments({ $or: [{ type: { $exists: false } }, { type: null }] });
  console.log(`Documents without type: ${count}`);
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
EOF
node /tmp/check-types.js
```

### 4. Rollback the Migration

If you need to undo the migration and remove the `type` field:

```bash
node migrations/rollback-funnelUrl-type.js
```

## Troubleshooting

### Connection Error: "getaddrinfo ENOTFOUND"

**Problem:** Cannot connect to MongoDB  
**Solution:** Verify MongoDB is running:

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB if needed (macOS with Homebrew)
brew services start mongodb-community
```

### Connection Error: "ECONNREFUSED"

**Problem:** MongoDB connection refused  
**Solution:** Check `.env` file settings:

```bash
# Test the connection URL in .env
echo "DB_NAME=$DB_NAME, HOST=$HOST, DB_PORT=$DB_PORT"

# Try connecting with mongo shell (if installed)
mongosh "mongodb://localhost:27017/bookaro"
```

### Error: "Invalid type"

**Problem:** Specified an invalid `--type` value  
**Solution:** Use only these values: `buyer`, `seller`, `owner_for_rent`, `owner_for_seller`

### No Documents Updated (matchedCount = 0)

**Reason:** All documents already have a type field  
**Status:** Migration has already been run or not needed  
**Action:** No action needed; database is in correct state

## Advanced Usage

### Count documents by type after migration:

```bash
cat > /tmp/count-by-type.js << 'EOF'
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: ".env" });
const { DB_PORT, HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
let mongoUrl = DB_USER ? `mongodb://${DB_USER}:${DB_PASSWORD}@${HOST}:${DB_PORT}/${DB_NAME}` : `mongodb://${HOST}:${DB_PORT}/${DB_NAME}`;

const schema = new mongoose.Schema({}, { strict: false });
const FunnelUrl = mongoose.model("funnelUrl", schema);

mongoose.connect(mongoUrl).then(async () => {
  const counts = await FunnelUrl.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log("\nDocuments by type:");
  counts.forEach(c => console.log(`  ${c._id || "null"}: ${c.count}`));
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
EOF
node /tmp/count-by-type.js
```

### Export data before migration:

```bash
# Backup all funnelUrl documents
mongoexport --uri "mongodb://localhost:27017/bookaro" --collection funnelUrl --out funnelUrl-backup.json
```

## Schema Reference

The `funnelUrl` schema includes:

```javascript
{
  topic: String,
  description: String,
  funnelStatus: String,
  youtubeUrl: String,
  duration: String,
  title: String,
  addedBy: ObjectId,
  image: String,
  videoOwner: String,
  tags: [ObjectId],
  type: String,  // ← Field being migrated
  viewCount: Number,
  viewersId: [ObjectId],
  status: String,
  timestamps: { createdAt, updatedAt }
}
```

## Questions or Issues?

- Check MongoDB connection: `mongosh "mongodb://localhost:27017/bookaro"`
- Review `.env` file settings
- Check migration logs in terminal output
- Use rollback script to revert if needed
