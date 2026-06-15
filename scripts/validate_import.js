const mongoose = require('mongoose');

async function main(){
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/bookaro';
  console.log('Connecting to', mongoUrl);
  await mongoose.connect(mongoUrl);
  const db = require('../app/models');

  try {
    const total = await db.pastTransaction.countDocuments();
    const years = await db.pastTransaction.distinct('year');
    const cnt2014 = await db.pastTransaction.countDocuments({ year: 2014 });
    const sample = await db.pastTransaction.findOne({ year: 2014 }).lean();
    const indexes = await db.pastTransaction.collection.indexes();

    console.log('RESULTS');
    console.log('total:', total);
    console.log('years (distinct):', years.sort());
    console.log('count year=2014:', cnt2014);
    console.log('sample doc keys:', sample ? Object.keys(sample).slice(0,50) : null);
    console.log('indexes:');
    console.dir(indexes, { depth: null });
  } catch (e){
    console.error('Validation error:', e);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
