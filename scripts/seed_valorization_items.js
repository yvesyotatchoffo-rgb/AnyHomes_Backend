const mongoose = require("mongoose");
const dbConfig = require("../app/config/db.config.js");

const ITEMS = [
  { label: "Faibles charges", label_en: "Low charges", order: 1 },
  { label: "Travaux récents", label_en: "Recent renovations", order: 2 },
  { label: "Bonne performance énergétique", label_en: "Good energy performance", order: 3 },
  { label: "Quartier recherché", label_en: "Desirable neighborhood", order: 4 },
  { label: "Extérieur agréable", label_en: "Pleasant outdoor space", order: 5 },
  { label: "Belle luminosité", label_en: "Great natural light", order: 6 },
  { label: "Potentiel locatif", label_en: "Rental potential", order: 7 },
  { label: "Proximité transports", label_en: "Close to public transport", order: 8 },
  { label: "Écoles à proximité", label_en: "Nearby schools", order: 9 },
  { label: "Cuisine équipée", label_en: "Fitted kitchen", order: 10 },
  { label: "Rangement optimisé", label_en: "Optimized storage", order: 11 },
  { label: "Vue dégagée", label_en: "Clear view", order: 12 },
  { label: "Sécurisé", label_en: "Secure building", order: 13 },
  { label: "Calme", label_en: "Quiet area", order: 14 },
];

async function seed() {
  await mongoose.connect(dbConfig.url);
  const db = mongoose.connection.db;
  const col = db.collection("valorizationitems");

  await col.deleteMany({});
  await col.insertMany(ITEMS.map((i) => ({ ...i, category: "", isActive: true, createdAt: new Date(), updatedAt: new Date() })));

  console.log(`Seeded ${ITEMS.length} valorization items`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
