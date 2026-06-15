const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');

async function main() {
  const defaultUrl = 'mongodb://localhost:27017/bookaro';
  let url = defaultUrl;
  try { url = dbConfig.url || defaultUrl; } catch (e) { url = defaultUrl; }

  console.log('Connecting to MongoDB at', url);
  await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  const coll = db.collection('transactions');

  console.log('\n--- imported docs by id_mutation ---');
  const docs = await coll.find({ id_mutation: { $in: ['m1','m2','m3','m4'] } }, { projection: { id_mutation:1, mutation_date:1, land_value_num:1, location:1, year:1 } }).toArray();
  console.log(JSON.stringify(docs, null, 2));

  console.log('\n--- geo query within 500m of [2.3522,48.8566] ---');
  try {
    const near = await coll.find({ location: { $near: { $geometry: { type: 'Point', coordinates: [2.3522,48.8566] }, $maxDistance: 500 } } }, { projection: { id_mutation:1, location:1, land_value_num:1, year:1 } }).toArray();
    console.log(JSON.stringify(near, null, 2));
  } catch (e) {
    console.error('Geo query failed:', e.message);
  }

  await mongoose.disconnect();
}

main().catch(e => { console.error(e && e.stack); process.exit(1); });
