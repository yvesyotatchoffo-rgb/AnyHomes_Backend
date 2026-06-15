const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { mapRowToDoc, defaultKeyMap } = require('../app/utils/pastTransactionsImporter');

const sample = process.argv[2] || '/tmp/bookaro_import_test/2014/sample.csv';

if (!fs.existsSync(sample)) {
  console.error('Sample CSV not found:', sample);
  process.exit(2);
}

async function run() {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(sample)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log('Loaded rows:', rows.length);
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const lower = Object.keys(row).reduce((acc, k) => { acc[k.trim().toLowerCase()] = row[k]; return acc; }, {});
    const doc = mapRowToDoc(lower, defaultKeyMap);
    console.log('--- Row', i + 1, '---');
    console.log('CSV:', row);
    console.log('Mapped doc:', JSON.stringify(doc, null, 2));
  }
}

run().catch(e => { console.error(e); process.exit(1); });
