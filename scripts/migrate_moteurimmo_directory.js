// Migration one-time : passe en Directory tous les biens MoteurImmo
// qui ont une deletionDate mais sont encore en sale/rent.
// Crée le timeline event moteurimmoLeavingMarket si absent.
//
// Usage : node scripts/migrate_moteurimmo_directory.js

const mongoose = require('mongoose');
const db = require('../app/models');

const BATCH_SIZE = 100;

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/bookaro');
  console.log('Connected to MongoDB');

  // Find system user for timeline addedBy
  const sysUser = await db.users.findOne({ email: 'system_anyhomes_importer@anyhomes.local' }).lean();
  if (!sysUser) {
    console.error('System user not found');
    process.exit(1);
  }
  const systemUserId = sysUser._id;
  console.log('System user:', systemUserId);

  // Find all properties that need migration
  const props = await db.property.find({
    importBy: 'platform',
    propertyType: { $in: ['sale', 'rent'] },
    deletionDate: { $ne: null, $exists: true }
  }).select('_id propertyTitle price deletionDate').lean();

  console.log(`Found ${props.length} properties to migrate`);

  let updated = 0;
  let timelineCreated = 0;

  for (let i = 0; i < props.length; i += BATCH_SIZE) {
    const batch = props.slice(i, i + BATCH_SIZE);
    const ids = batch.map(p => p._id);

    // Preload external listings for this batch
    const extListings = await db.externalListing.find({ propertyId: { $in: ids } }).lean();
    const extMap = {};
    extListings.forEach(el => { extMap[String(el.propertyId)] = el; });

    for (const prop of batch) {
      const el = extMap[String(prop._id)];

      // Determine reason from MoteurImmo options
      const options = el?.raw?.options || [];
      let reason = 'removed';
      if (options.includes('isSoldRented')) reason = 'soldRented';
      else if (options.includes('isUnderCompromise')) reason = 'underCompromise';

      // Update property
      await db.property.updateOne(
        { _id: prop._id },
        { $set: { propertyType: 'directory', updatedAt: new Date() } }
      );

      // Update external listing
      if (el) {
        await db.externalListing.updateOne(
          { _id: el._id },
          { $set: { status: 'inactive', lastSyncAt: new Date() } }
        );
      }

      updated++;

      // Create timeline event if not exists
      const exists = await db.timeline.findOne({
        propertyId: prop._id,
        type: 'moteurimmoLeavingMarket'
      }).lean();
      if (!exists) {
        await db.timeline.create({
          propertyId: prop._id,
          addedBy: systemUserId,
          type: 'moteurimmoLeavingMarket',
          createdAt: prop.deletionDate || new Date(),
          meta: {
            reason,
            lastPrice: prop.price || 0,
            agencyName: el?.raw?.publisher?.name || null,
            statusBadge: 'directory',
          }
        });
        timelineCreated++;
      }
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, props.length)} / ${props.length} | updated: ${updated} | timelines: ${timelineCreated}`);
  }

  console.log(`\nDone! ${updated} properties updated, ${timelineCreated} timeline events created.`);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
