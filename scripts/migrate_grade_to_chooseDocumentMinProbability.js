require('dotenv').config();
const mongoose = require('mongoose');
const dbConfig = require('../app/config/db.config');
const db = require('../app/models');

const mapGradeToProbability = (grade) => {
  switch ((grade || 'Any').toUpperCase()) {
    case 'A':
      return 90;
    case 'B':
      return 75;
    case 'C':
      return 55;
    case 'D':
      return 35;
    case 'E':
      return 15;
    default:
      return 0;
  }
};

async function main() {
  await mongoose.connect(dbConfig.url, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const cursor = db.property.find({
    isDeleted: false,
    chooseDocumentGrade: { $in: ['A', 'B', 'C', 'D', 'E'] },
    $or: [
      { chooseDocumentMinProbability: { $exists: false } },
      { chooseDocumentMinProbability: 0 }
    ]
  }).cursor();

  let updated = 0;
  let skipped = 0;

  for (let property = await cursor.next(); property != null; property = await cursor.next()) {
    try {
      const mappedProbability = mapGradeToProbability(property.chooseDocumentGrade);
      if (mappedProbability === 0) {
        skipped++;
        continue;
      }

      await db.property.updateOne(
        { _id: property._id },
        { chooseDocumentMinProbability: mappedProbability }
      );
      console.log(`Updated property ${property._id} grade=${property.chooseDocumentGrade} -> minProbability=${mappedProbability}`);
      updated++;
    } catch (err) {
      console.error('Error updating property', property._id.toString(), err.message || err);
    }
  }

  console.log(`Migration complete. Updated: ${updated}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
