MongoDB import guide for Past Transactions

1) Recommended approach for the initial (massive) import

- Import into a temporary collection to avoid impacting production `transactions` during the load. Example using `mongoimport`:

```bash
# on a machine that can reach your MongoDB server
mongoimport --uri "mongodb://USER:PASS@HOST:PORT/DBNAME" \
  --collection transactions_import --type csv --headerline --file "/path/to/your/file.csv" \
  --numInsertionWorkers 4 --batchSize 10000
```

- Repeat for each CSV file (or concatenate files) into `transactions_import`.

2) Create indexes (after import)

Run the Node script to create text, numeric and geo indexes on the imported collection:

```bash
node scripts/create_indexes.js transactions_import
```

3) Validate

- Connect with `mongo` shell and run basic checks:
```js
db.transactions_import.count()
db.transactions_import.findOne({ postal_code: /750/ })
```

4) Swap collections (rename) — do during a maintenance window

```js
# from mongo shell
db.transactions.renameCollection('transactions_backup_' + Date.now())
db.transactions_import.renameCollection('transactions')
```

5) Optional: run numeric migration script if required

- If you imported raw strings and need to fill shadow numeric fields, run:
```bash
curl -X GET "http://localhost:6089/transaction/migration"
```

6) Notes
- If your CSV is extremely large, prefer running `mongoimport` on a machine close to the DB for network throughput.
- Drop or avoid creating indexes before bulk import to speed up inserts. Creating indexes after import is much faster.
- Keep `transactions_backup` until you verify the app.
