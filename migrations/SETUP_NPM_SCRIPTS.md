# Optional: Add Migration Scripts to package.json

If you want to run migrations using `npm run` commands, add these scripts to your `package.json`:

## Add These Lines

Open `package.json` and add to the `"scripts"` section:

```json
{
  "scripts": {
    "migrate:test": "node migrations/test-migration.js",
    "migrate:run": "node migrations/add-type-to-funnelUrl.js",
    "migrate:rollback": "node migrations/rollback-funnelUrl-type.js"
  }
}
```

## Complete Example

Your `"scripts"` section should look like:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "migrate:test": "node migrations/test-migration.js",
    "migrate:run": "node migrations/add-type-to-funnelUrl.js",
    "migrate:rollback": "node migrations/rollback-funnelUrl-type.js"
  }
}
```

## Usage

Once added to package.json, you can run:

```bash
# Preview the migration (dry-run)
npm run migrate:test

# Run the migration
npm run migrate:run

# Rollback the migration
npm run migrate:rollback

# With custom type (requires full command, not through npm)
node migrations/add-type-to-funnelUrl.js --type=owner_for_rent
```

## Why Use npm Scripts?

- ✅ Consistent with your existing workflow
- ✅ Easier to remember commands
- ✅ Easy to share with team members
- ✅ Part of your documented setup process
- ✅ Can be integrated into CI/CD pipelines

## Alternative: Add to Script Package

If you prefer, you can also create a convenience wrapper:

```bash
cat > scripts/migrate.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/.."
case "$1" in
  test)
    node migrations/test-migration.js
    ;;
  run)
    node migrations/add-type-to-funnelUrl.js "${@:2}"
    ;;
  rollback)
    node migrations/rollback-funnelUrl-type.js
    ;;
  *)
    echo "Usage: $0 {test|run|rollback}"
    exit 1
    ;;
esac
EOF
chmod +x scripts/migrate.sh
```

Then use:
```bash
./scripts/migrate.sh test
./scripts/migrate.sh run
./scripts/migrate.sh rollback
```
