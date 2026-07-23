/**
 * Script de mise à jour des aménités avec leurs traductions anglaises (title_en)
 * 
 * Usage: node scripts/updateAmenitiesEn.js
 */

const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config");

const AMENITIES_EN = {
  "ascenseur": "Elevator",
  "interphone": "Intercom",
  "digicode": "Entry code",
  "gardien": "Caretaker",
  "fibre optique": "Fiber optic",
  "cuisine équipée": "Fitted kitchen",
  "cuisine américaine": "American kitchen",
  "cuisine ouverte": "Open kitchen",
  "balcon": "Balcony",
  "terrasse": "Terrace",
  "jardin": "Garden",
  "parking": "Parking",
  "garage": "Garage",
  "cave": "Cellar",
  "local à vélos": "Bike storage",
  "local poussette": "Stroller storage",
  "cave individuelle": "Private cellar",
  "transports à proximité": "Nearby transport",
  "commerces": "Shops",
  "quartier calme": "Quiet neighborhood",
  "quartier animé": "Lively neighborhood",
  "vue dégagée": "Open view",
  "piscine": "Swimming pool",
  "salle de sport": "Gym",
  "espace vert": "Green space",
  "potentiel locatif": "Rental potential",
  "programme neuf": "New development",
  "chauffage individuel gaz": "Individual gas heating",
  "chauffage individuel électrique": "Individual electric heating",
  "chauffage collectif gaz": "Central gas heating",
  "chauffage collectif électrique": "Central electric heating",
  "pompe à chaleur": "Heat pump",
  "chauffage au sol": "Underfloor heating",
  "chauffage bois": "Wood heating",
  "climatisation réversible": "Reversible air conditioning",
  "convecteur électrique": "Electric convector",
  "radiateur électrique": "Electric radiator",
  "gaz de ville": "Town gas",
  "fioul": "Oil heating",
  "électrique": "Electric",
  "bois": "Wood",
  "solaire": "Solar",
};

async function main() {
  await mongoose.connect(dbConfig.url);
  console.log("✅ Connecté à MongoDB");

  const Amenity = mongoose.model("amenities", new mongoose.Schema({ title: String, title_en: String }, { strict: false }));
  
  let updated = 0;
  let notFound = [];
  let skipped = 0;

  for (const [frTitle, enTitle] of Object.entries(AMENITIES_EN)) {
    const regex = new RegExp(`^${frTitle}$`, "i");
    const result = await Amenity.updateMany(
      { title: regex, $or: [{ title_en: "" }, { title_en: { $exists: false } }] },
      { $set: { title_en: enTitle } }
    );
    if (result.modifiedCount > 0) {
      updated += result.modifiedCount;
    } else {
      notFound.push(frTitle);
    }
  }

  console.log(`\n✅ ${updated} aménités mises à jour avec title_en`);
  if (notFound.length > 0) {
    console.log(`⚠️ ${notFound.length} aménités non trouvées (vérifiez l'orthographe):`);
    notFound.forEach(n => console.log(`   - ${n}`));
  }

  await mongoose.disconnect();
  console.log("\n✅ Terminé");
}

main().catch(err => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
