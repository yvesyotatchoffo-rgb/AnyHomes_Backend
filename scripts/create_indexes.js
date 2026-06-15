const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');

async function createIndexes(collectionName = 'transactions') {
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  const col = db.collection(collectionName);
  console.log('Creating indexes on', collectionName);

  try {
    // text index on address/community/postal_code
    await col.createIndex({ address_channel_name: 'text', community_name: 'text', postal_code: 'text' }, { name: 'text_search_addr' });

    // ensure numeric indexes
    await col.createIndex({ land_value_num: 1 }, { name: 'idx_land_value_num' });
    await col.createIndex({ lot1_surface_carrez_num: 1 }, { name: 'idx_surface_num' });
    await col.createIndex({ number_of_main_pieces_num: 1 }, { name: 'idx_pieces_num' });

    // compound indexes for common filters
    await col.createIndex({ year: 1, land_value_num: 1 }, { name: 'idx_year_price' });
    await col.createIndex({ createdAt: -1 }, { name: 'idx_createdAt' });

    // geospatial index (safe-create if not present)
    try {
      await col.createIndex({ location: '2dsphere' }, { name: 'idx_location_2dsphere' });
    } catch (e) {
      console.warn('2dsphere index creation warning:', e.message);
    }

    console.log('Indexes created');
  } catch (err) {
    console.error('Error creating indexes:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

const args = process.argv.slice(2);
createIndexes(args[0]).catch(err => { console.error(err); process.exit(1); });
