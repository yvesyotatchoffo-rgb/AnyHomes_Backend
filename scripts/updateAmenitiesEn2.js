const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config");

const AMENITIES_EN = {
  "ascenseur": "Elevator",
  "interphone": "Intercom",
  "digicode / interphone": "Entry code / Intercom",
  "fibre optique": "Fiber optic",
  "cuisine équipée": "Fitted kitchen",
  "cuisine américaine": "American kitchen",
  "cuisine semi-équipée": "Semi-fitted kitchen",
  "coin cuisine": "Kitchenette",
  "balcon": "Balcony",
  "terrasse": "Terrace",
  "jardin": "Garden",
  "parking": "Parking",
  "cave": "Cellar",
  "local à vélos": "Bike storage",
  "vue dégagée": "Open view",
  "piscine": "Swimming pool",
  "salle de sport": "Gym",
  "chauffage individuel gaz": "Individual gas heating",
  "chauffage individuel électrique": "Individual electric heating",
  "chauffage collectif gaz": "Central gas heating",
  "chauffage collectif électrique": "Central electric heating",
  "pompe à chaleur": "Heat pump",
  "gaz": "Gas",
  "électricité": "Electricity",
  "bois / pellets": "Wood / Pellets",
  "solaire": "Solar",
  "fioul": "Oil heating",
  "sauna": "Sauna",
  "loggia": "Loggia",
  "véranda": "Veranda",
  "accès handicapé": "Wheelchair accessible",
  "vidéophone": "Video phone",
  "gardiennage": "Security guard",
  "box": "Box / Garage",
  "buanderie": "Laundry room",
  "vue mer": "Sea view",
  "vue montagne": "Mountain view",
  "jacuzzi": "Jacuzzi",
  "salle de jeux": "Game room",
  "cinéma privé": "Private cinema",
  "court de tennis": "Tennis court",
  "meublé": "Furnished",
  "non meublé": "Unfurnished",
  "location saisonnière": "Seasonal rental",
  "colocation": "Shared rental",
  "résidence services": "Service residence",
  "individuel": "Individual",
  "collectif": "Collective",
  "quartier calme": "Quiet neighborhood",
  "commerces": "Shops",
  "transports à proximité": "Nearby transport",
};

async function main() {
  await mongoose.connect(dbConfig.url);
  const Amenity = mongoose.model("amenities", new mongoose.Schema({ title: String }, { strict: false }));

  let updated = 0;
  for (const [fr, en] of Object.entries(AMENITIES_EN)) {
    const escaped = fr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp("^" + escaped + "$", "i");
    const result = await Amenity.updateMany(
      { title: regex, $or: [{ title_en: "" }, { title_en: { $exists: false } }] },
      { $set: { title_en: en } }
    );
    updated += result.modifiedCount || 0;
  }

  console.log(`✅ ${updated} aménités mises à jour avec title_en`);
  await mongoose.disconnect();
}

main().catch(console.error);
