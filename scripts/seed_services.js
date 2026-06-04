const db = require('../app/models');

(async () => {
  try {
    await db.mongoose.connect(db.url, {});
    console.log('Connected to DB, inserting services...');
    const names = ['Négociation', 'recherche de bien', 'vente', 'Estimation'];
    for (const name of names) {
      const exists = await db.services.findOne({ name, isDeleted: false });
      if (exists) {
        console.log('Exists:', name);
        continue;
      }
      await db.services.create({ name, status: 'active' });
      console.log('Created:', name);
    }
    const all = await db.services.find({ name: { $in: names } }).lean();
    console.log('Inserted services:', all);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding services:', err);
    process.exit(1);
  }
})();
