#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const { importFromDirectory } = require('../app/utils/pastTransactionsImporter');

async function main() {
  const args = process.argv.slice(2);
  const rootDir = args[0] || '/Users/yvesyotatchoffo/Mon Drive/Anyhomes/01_Product/05_Database/03_Past transactions';
  const yearsArg = args[1] || '2014,2024';
  const years = yearsArg.split(',').map(s => s.trim());

  console.log('Connecting to mongo:', dbConfig.url);
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to mongo');

  try {
    const res = await importFromDirectory(rootDir, years, { batchSize: 5000 });
    console.log('Import finished:', res);
  } catch (err) {
    console.error('Import error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
