// Association libellé -> picto (nom Lucide). Utilisée pour valorisations,
// espaces et prestations dans le dossier de visite. Fallback générique.
const VALORIZATION_ICONS = {
  "faibles charges": "PiggyBank",
  "travaux récents": "Hammer",
  "bonne performance énergétique": "Leaf",
  "quartier recherché": "MapPin",
  "extérieur agréable": "Trees",
  "belle luminosité": "Sun",
  "potentiel locatif": "TrendingUp",
  "proximité transports": "Bus",
  "écoles à proximité": "GraduationCap",
  "cuisine équipée": "ChefHat",
  "rangement optimisé": "Boxes",
  "vue dégagée": "Mountain",
  "sécurisé": "Shield",
  "calme": "Moon",
  "parquet": "Layers",
  "balcon": "Wind",
  "terrasse": "Sunset",
  "jardin": "Trees",
  "cave": "Warehouse",
  "garage": "Car",
  "grenier": "Archive",
  "abri de jardin": "Tent",
  "buanderie": "WashingMachine",
  "local à vélo": "Bike",
  "box": "Package",
  "piscine": "Waves",
  "salle de sport": "Dumbbell",
  "ascenseur": "ArrowUpDown",
  "sécurité d'accès": "ShieldCheck",
  "interphone": "Phone",
  "concierge": "ConciergeBell",
  "cuisine": "ChefHat",
  "véranda": "Sun",
  "bureau": "Briefcase",
  "salle à manger": "Utensils",
  "chambre": "BedDouble",
  "séjour": "Sofa",
  "salle de bain": "Bath",
  "pièce": "DoorOpen",
  "verrière": "GlassWater",
  "double séjour": "Sofa",
  "mezzanine": "Layers",
  "combles": "Archive",
  "sous-sol": "Warehouse",
};

const iconForLabel = (label) => {
  if (!label) return "Sparkles";
  const key = String(label).toLowerCase().trim();
  return VALORIZATION_ICONS[key] || "Sparkles";
};

module.exports = { VALORIZATION_ICONS, iconForLabel };
