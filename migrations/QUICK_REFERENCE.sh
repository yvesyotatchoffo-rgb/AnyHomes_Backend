#!/usr/bin/env bash
# Quick Reference Card for Migration Scripts
# Save this and keep it handy!

# ════════════════════════════════════════════════════════════════
# FunnelUrl Type Migration - Quick Reference
# ════════════════════════════════════════════════════════════════

# LOCATION
# /Users/yvesyotatchoffo/Mon Drive/Anyhomes/01_Product/01_MVP/Code/Backend/api_bookaro-lovepreet/migrations/

# ════════════════════════════════════════════════════════════════
# QUICK START
# ════════════════════════════════════════════════════════════════

# 1. Navigate to backend directory
cd "/Users/yvesyotatchoffo/Mon Drive/Anyhomes/01_Product/01_MVP/Code/Backend/api_bookaro-lovepreet"

# 2. Preview what would be updated (SAFE - no changes)
node migrations/test-migration.js

# 3. Run the migration
node migrations/add-type-to-funnelUrl.js

# 4. Verify results
node migrations/test-migration.js

# ════════════════════════════════════════════════════════════════
# ALL COMMANDS
# ════════════════════════════════════════════════════════════════

# Preview with default type "buyer"
node migrations/test-migration.js

# Preview with custom type
node migrations/test-migration.js --type=owner_for_rent

# Apply migration with default type "buyer"
node migrations/add-type-to-funnelUrl.js

# Apply migration with custom type
node migrations/add-type-to-funnelUrl.js --type=seller

# Rollback migration (undo)
node migrations/rollback-funnelUrl-type.js

# ════════════════════════════════════════════════════════════════
# VALID TYPES
# ════════════════════════════════════════════════════════════════
# - buyer (DEFAULT)
# - seller
# - owner_for_rent
# - owner_for_seller

# ════════════════════════════════════════════════════════════════
# DOCUMENTATION
# ════════════════════════════════════════════════════════════════

# Overview and status
cat migrations/OVERVIEW.md

# Quick start guide
cat migrations/README.md

# Comprehensive guide
cat migrations/MIGRATION.md

# npm script setup (optional)
cat migrations/SETUP_NPM_SCRIPTS.md

# ════════════════════════════════════════════════════════════════
# CURRENT DATABASE STATUS
# ════════════════════════════════════════════════════════════════
# Total documents:    4
# Without type:       0 ✓ (no migration needed)
# With type:          4
# Distribution:       3x owner_for_seller, 1x buyer

# ════════════════════════════════════════════════════════════════
# WHAT EACH SCRIPT DOES
# ════════════════════════════════════════════════════════════════

# add-type-to-funnelUrl.js
# ├─ Connects to MongoDB
# ├─ Finds documents without type field
# ├─ Updates them with default type
# ├─ Shows matched/modified counts
# └─ Verifies with sample documents

# test-migration.js (DRY-RUN)
# ├─ Reads current status
# ├─ Shows what WOULD be updated
# ├─ Displays type distribution (before/after)
# ├─ Lists sample documents
# └─ NO CHANGES MADE (safe to run anytime)

# rollback-funnelUrl-type.js
# ├─ Removes type field from all documents
# ├─ Reverts the migration
# ├─ Shows affected counts
# └─ Useful if you need to undo

# ════════════════════════════════════════════════════════════════
# TROUBLESHOOTING
# ════════════════════════════════════════════════════════════════

# MongoDB connection issues?
ps aux | grep mongod  # Check if MongoDB is running
brew services start mongodb-community  # Start MongoDB

# Invalid type error?
# Use only: buyer, seller, owner_for_rent, owner_for_seller
node migrations/add-type-to-funnelUrl.js --type=buyer

# .env not loading?
cat .env | grep DB_  # Verify settings exist

# ════════════════════════════════════════════════════════════════
# WORKFLOW
# ════════════════════════════════════════════════════════════════

# Safe Approach (Recommended):
# 1. node migrations/test-migration.js          # Preview
# 2. node migrations/add-type-to-funnelUrl.js   # Run
# 3. node migrations/test-migration.js          # Verify
# 4. (if needed) node migrations/rollback-funnelUrl-type.js  # Undo

# Quick Approach:
# node migrations/add-type-to-funnelUrl.js

# ════════════════════════════════════════════════════════════════
# FILE STRUCTURE
# ════════════════════════════════════════════════════════════════

# migrations/
# ├── add-type-to-funnelUrl.js      Main migration script
# ├── test-migration.js              Dry-run preview
# ├── rollback-funnelUrl-type.js     Undo script
# ├── README.md                      Quick start
# ├── MIGRATION.md                   Full docs
# ├── OVERVIEW.md                    Status & summary
# ├── SETUP_NPM_SCRIPTS.md           Optional npm setup
# └── QUICK_REFERENCE.sh             This file

# ════════════════════════════════════════════════════════════════
# NOTES
# ════════════════════════════════════════════════════════════════

# All scripts use the same .env configuration as the backend API
# No hardcoded values - fully configurable
# All scripts include comprehensive error handling
# MongoDB connection pooling handled by Mongoose

# ════════════════════════════════════════════════════════════════
# CREATED
# ════════════════════════════════════════════════════════════════
# Date:   2026-06-26
# Status: ✅ Ready to use
# Tested: ✅ Yes (0 documents need updating)

# For more details, see OVERVIEW.md or README.md
