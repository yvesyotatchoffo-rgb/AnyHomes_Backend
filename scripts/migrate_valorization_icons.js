/**
 * Migration : associe un picto (nom Lucide) aux éléments de valorisation existants.
 * Usage : node scripts/migrate_valorization_icons.js
 */
require("dotenv").config();
const db = require("../app/models");
const { iconForLabel } = require("../app/utls/valorizationIcons");

const run = async () => {
  await db.mongoose.connect(db.url, {});
  const items = await db.valorizationItem.find({}).lean();
  let updated = 0;
  for (const item of items) {
    const icon = item.icon || iconForLabel(item.label);
    if (icon !== item.icon) {
      await db.valorizationItem.updateOne({ _id: item._id }, { $set: { icon } });
      updated++;
    }
  }
  console.log(`Valorization items traités : ${items.length}, mis à jour : ${updated}`);
  await db.mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
