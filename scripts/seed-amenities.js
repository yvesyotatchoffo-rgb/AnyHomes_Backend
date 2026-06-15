/**
 * Seed script — Amenities, Categories, Revenue types
 * Run: node scripts/seed-amenities.js
 *
 * Peuple les collections nécessaires pour que les sections de
 * /property/add/3 (step4) et /property/add/4 (step5) s'affichent.
 *
 * Sections step4 (characteristic) attendues :
 *   - État du bien        → revenues type="State"
 *   - Type de cuisine     → amenity category "Cooking"
 *   - Équipement          → amenity category "Equipment"
 *   - Extérieur           → amenity category "Outside"
 *   - Services            → amenity category "Services and accessibility"
 *   - Annexes             → amenity category "ancilliary areas"
 *   - Environnement       → amenity category "Environment"
 *   - Divertissement      → amenity category "Leisure"
 *   - Investissement      → amenity category "investment"
 *
 * Sections step5 (energy) attendues :
 *   - Mode de chauffage   → amenity category "Heating type"
 *   - Type de chauffage   → amenity category "Consumption mode"
 */

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URL = process.env.DB_URL || "mongodb://localhost:27017/bookaro";

// ── Schémas inline (miroir des modèles) ────────────────────────────────────
const categorySchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    image: String,
    type: { type: String, enum: ["parent", "child"], default: "parent" },
    status: { type: String, default: "active" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
categorySchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const amenitySchema = new mongoose.Schema(
  {
    title: String,
    image: String,
    description: String,
    status: { type: String, default: "active" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
amenitySchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

const revenueSchema = new mongoose.Schema(
  {
    name: String,
    type: {
      type: String,
      enum: ["State", "Revenue", "Revenue-Source", "Expense", "Ratings", "Renovation"],
    },
    image: String,
    status: { type: String, default: "active" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
revenueSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

// ── Données de seed ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: "Cooking",                    slug: "cooking" },
  { name: "Equipment",                  slug: "equipment" },
  { name: "Outside",                    slug: "outside" },
  { name: "Services and accessibility", slug: "services-and-accessibility" },
  { name: "ancilliary areas",           slug: "ancilliary-areas" },
  { name: "Environment",                slug: "environment" },
  { name: "Leisure",                    slug: "leisure" },
  { name: "investment",                 slug: "investment" },
  // step5
  { name: "Heating type",               slug: "heating-type" },
  { name: "Consumption mode",           slug: "consumption-mode" },
];

// Amenities par catégorie (name = titre affiché, lowercased by backend)
const AMENITIES_BY_CATEGORY = {
  "Cooking": [
    "Cuisine américaine",
    "Cuisine équipée",
    "Cuisine semi-équipée",
    "Coin cuisine",
  ],
  "Equipment": [
    "Ascenseur",
    "Digicode / Interphone",
    "Gardien",
    "Parking",
    "Cave",
    "Piscine",
    "Salle de sport",
    "Sauna",
  ],
  "Outside": [
    "Balcon",
    "Terrasse",
    "Jardin",
    "Loggia",
    "Véranda",
  ],
  "Services and accessibility": [
    "Accès handicapé",
    "Fibre optique",
    "Interphone",
    "Vidéophone",
    "Gardiennage",
  ],
  "ancilliary areas": [
    "Cave",
    "Box",
    "Parking",
    "Local à vélos",
    "Buanderie",
  ],
  "Environment": [
    "Vue mer",
    "Vue montagne",
    "Vue dégagée",
    "Quartier calme",
    "Proche forêt",
    "Proche lac",
  ],
  "Leisure": [
    "Piscine",
    "Jacuzzi",
    "Sauna",
    "Salle de jeux",
    "Cinéma privé",
    "Court de tennis",
  ],
  "investment": [
    "Meublé",
    "Non meublé",
    "Location saisonnière",
    "Colocation",
    "Résidence services",
  ],
  // step5
  "Heating type": [
    "Individuel",
    "Collectif",
  ],
  "Consumption mode": [
    "Gaz",
    "Électricité",
    "Fioul",
    "Pompe à chaleur",
    "Bois / Pellets",
    "Solaire",
  ],
};

// État du bien — revenues avec type="State"
const REVENUE_STATES = [
  "Neuf",
  "Excellent état",
  "Bon état",
  "À rafraîchir",
  "À rénover",
  "À démolir",
];

// ── Runner ──────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URL);
  console.log("✓ Connecté à MongoDB:", MONGO_URL);

  const Category = mongoose.model("categories", categorySchema);
  const Amenity  = mongoose.model("amenities",  amenitySchema);
  const Revenue  = mongoose.model("revenueManagement", revenueSchema);

  // 1. Catégories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    let existing = await Category.findOne({ name: cat.name, isDeleted: false });
    if (!existing) {
      existing = await Category.create(cat);
      console.log(`  + Catégorie créée: "${cat.name}"`);
    } else {
      console.log(`  ~ Catégorie existante: "${cat.name}"`);
    }
    categoryMap[cat.name] = existing._id;
  }

  // 2. Amenities
  for (const [catName, titles] of Object.entries(AMENITIES_BY_CATEGORY)) {
    const catId = categoryMap[catName];
    if (!catId) {
      console.warn(`  ⚠ Catégorie non trouvée: "${catName}" — amenities ignorées`);
      continue;
    }
    for (const title of titles) {
      const existing = await Amenity.findOne({ title, isDeleted: false });
      if (!existing) {
        await Amenity.create({ title, categoryId: catId });
        console.log(`    + Amenity créée: "${title}" [${catName}]`);
      }
    }
  }

  // 3. Revenue states
  for (const name of REVENUE_STATES) {
    const existing = await Revenue.findOne({ name, type: "State", isDeleted: false });
    if (!existing) {
      await Revenue.create({ name, type: "State" });
      console.log(`  + Revenue State créé: "${name}"`);
    }
  }

  console.log("\n✅ Seed terminé.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
