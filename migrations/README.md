# Migration Scripts Setup Summary

## ✅ What Was Created

The following migration scripts have been created in your backend `/migrations/` directory:

### 1. **add-type-to-funnelUrl.js** (Main Migration Script)
- **Purpose:** Adds default `type` field to funnelUrl documents that don't have one
- **What it does:**
  - Connects to MongoDB using your `.env` configuration
  - Finds documents with missing/null/empty type field
  - Updates them with a default type (default: "buyer")
  - Shows statistics on matched/modified documents
- **Full error handling** with helpful messages

### 2. **test-migration.js** (Dry-Run Script)
- **Purpose:** Preview what the migration would do WITHOUT making changes
- **What it shows:**
  - Connection status
  - Collection statistics (total docs, without type, with type)
  - Current type distribution
  - List of documents that WOULD be updated
  - Projected type distribution after migration
- **Safe:** Read-only, no modifications

### 3. **rollback-funnelUrl-type.js** (Undo Script)
- **Purpose:** Reverse the migration by removing type fields
- **When to use:** If you need to revert to pre-migration state

### 4. **MIGRATION.md** (Documentation)
- Complete guide with examples
- Troubleshooting section
- Advanced usage examples

---

## 📊 Current Database Status

As of now (2026-06-26):

```
Total funnelUrl documents:     4
Documents WITHOUT type:        0  ✓ (no migration needed)
Documents WITH type:           4

Distribution:
  - owner_for_seller:          3
  - buyer:                      1
```

**Status:** Your database is already in good shape! All documents have a type field.

---

## 🚀 Quick Start Guide

### Step 1: Preview (Optional but Recommended)
```bash
cd /Users/yvesyotatchoffo/Mon\ Drive/Anyhomes/01_Product/01_MVP/Code/Backend/api_bookaro-lovepreet
node migrations/test-migration.js
```

### Step 2: Run Migration (if needed)
```bash
# With default type "buyer"
node migrations/add-type-to-funnelUrl.js

# Or with custom type
node migrations/add-type-to-funnelUrl.js --type=owner_for_rent
```

Valid type options:
- `buyer` (default)
- `seller`
- `owner_for_rent`
- `owner_for_seller`

### Step 3: Verify Results
```bash
node migrations/test-migration.js
```

The test script will show the updated type distribution.

### Step 4: If Something Goes Wrong
```bash
# Rollback the migration
node migrations/rollback-funnelUrl-type.js
```

---

## 📝 Database Connection Details

The scripts use your `.env` file:
```env
HOST=localhost
DB_PORT=27017
DB_NAME=bookaro
DB_USER=(optional)
DB_PASSWORD=(optional)
```

**Prerequisites:**
- MongoDB must be running
- Backend dependencies installed (`npm install`)

---

## 🔍 How to Use Each Script

### Test Migration (Dry-Run)
```bash
# Preview with default type
node migrations/test-migration.js

# Preview with custom type
node migrations/test-migration.js --type=owner_for_rent
```

**Output includes:**
- ✅ Connection status
- 📊 Current statistics
- 📋 Type distribution before and after
- 🔍 Sample of documents that would be updated

### Run Migration
```bash
# Apply migration with default type "buyer"
node migrations/add-type-to-funnelUrl.js
```

**Output includes:**
- 📝 Configuration details
- 🔄 Connection status
- 🔍 Number of documents found
- ⏳ Progress indicator
- 📊 Results (matched, modified counts)
- ✅ Verification of updated samples

### Rollback
```bash
# Reverse the migration
node migrations/rollback-funnelUrl-type.js
```

**Output includes:**
- ⚠️ Warning message
- 📊 Number of documents with type field
- ✅ Results of removal operation

---

## 🛠 Troubleshooting

### MongoDB Connection Issues

**Error: "getaddrinfo ENOTFOUND"**
```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start MongoDB (if using Homebrew)
brew services start mongodb-community
```

**Error: "ECONNREFUSED"**
- Verify `.env` settings: HOST, DB_PORT, DB_NAME
- Try connecting manually: `mongosh mongodb://localhost:27017/bookaro`

### Invalid Type Error

If you see: `Error: Invalid type "xyz"`
- Use only: `buyer`, `seller`, `owner_for_rent`, `owner_for_seller`
- Example: `node migrations/add-type-to-funnelUrl.js --type=seller`

### No Documents Found

If `modifiedCount: 0`:
- All documents already have a type field ✓
- Migration has already been run
- Or no funnelUrl documents exist in database

---

## 📂 File Locations

```
api_bookaro-lovepreet/
├── migrations/
│   ├── add-type-to-funnelUrl.js       ← Main migration script
│   ├── test-migration.js              ← Dry-run preview
│   ├── rollback-funnelUrl-type.js     ← Undo script
│   ├── MIGRATION.md                   ← Full documentation
│   └── README.md                      ← This file
├── app/
│   ├── config/db.config.js            ← DB connection setup
│   ├── models/funnelUrl.model.js      ← Schema definition
│   └── ...
└── .env                               ← Configuration
```

---

## 📚 Schema Reference

The funnelUrl model contains:
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
  type: String,                    // ← The field being managed
  viewCount: Number,
  viewersId: [ObjectId],
  status: String,
  timestamps: { createdAt, updatedAt }
}
```

**Valid type values:** `"owner_for_rent"`, `"owner_for_seller"`, `"seller"`, `"buyer"`

---

## 🎯 What Each Script Does

| Script | Purpose | Effect | Safe |
|--------|---------|--------|------|
| `test-migration.js` | Preview migration | None (read-only) | ✅ Yes |
| `add-type-to-funnelUrl.js` | Apply migration | Adds type field | ⚠️ Modifies DB |
| `rollback-funnelUrl-type.js` | Undo migration | Removes type field | ⚠️ Modifies DB |

---

## ✨ Key Features

✅ **Robust Error Handling**
- Validates MongoDB connection
- Validates type values
- Clear error messages

✅ **Dry-Run Support**
- Preview changes before applying
- No risk of unintended modifications

✅ **Rollback Capability**
- Can undo migration if needed
- Preserves data integrity

✅ **Environment-Based Configuration**
- Uses same `.env` as backend API
- No hardcoded values
- Works with or without MongoDB authentication

✅ **Detailed Logging**
- Shows connection status
- Progress indicators
- Results summary
- Verification samples

---

## 🎓 Learning Resources

### To understand the scripts:
1. Review the main script: `add-type-to-funnelUrl.js`
2. Check the schema: `app/models/funnelUrl.model.js`
3. See DB config: `app/config/db.config.js`

### MongoDB Documentation:
- [updateMany()](https://docs.mongodb.com/manual/reference/method/db.collection.updateMany/)
- [find()](https://docs.mongodb.com/manual/reference/method/db.collection.find/)
- [$unset operator](https://docs.mongodb.com/manual/reference/operator/update/unset/)

---

## 📞 Need Help?

1. **Check logs:** Run `test-migration.js` to see current state
2. **Review MIGRATION.md:** Comprehensive guide with examples
3. **Check connection:** `mongosh mongodb://localhost:27017/bookaro`
4. **Verify .env:** Ensure DB settings are correct

---

## 🔄 Migration Workflow Example

```bash
# 1. Verify the current state
node migrations/test-migration.js

# 2. If needed, run the migration
node migrations/add-type-to-funnelUrl.js

# 3. Verify the results
node migrations/test-migration.js

# 4. If something went wrong, rollback
node migrations/rollback-funnelUrl-type.js
```

---

## ✅ Verification Checklist

- [ ] MongoDB is running
- [ ] `.env` file has correct DB settings
- [ ] Backend dependencies installed (`npm install`)
- [ ] Ran `test-migration.js` to preview
- [ ] Ran main migration script
- [ ] Ran `test-migration.js` again to verify
- [ ] Results match expectations

---

Created: 2026-06-26
Last Updated: 2026-06-26
Status: Ready to use ✅
