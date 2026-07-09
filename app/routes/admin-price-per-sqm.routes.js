const express = require("express");
const router = express.Router();
const multer = require("multer");
const xlsx = require("xlsx");
const db = require("../models/index");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── helpers ──────────────────────────────────────────────────────────────────

// Pad numeric postal codes to 5 digits (handles 1-4 digit values from Excel)
const pad = (v) => {
  const s = String(v || "").trim();
  const n = s.replace(/\s/g, "");
  if (/^\d{1,4}$/.test(n)) return n.padStart(5, "0");
  return n;
};

// Case-insensitive flexible column lookup
const getCol = (row, ...names) => {
  const keys = Object.keys(row);
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
    const found = keys.find((k) => k.toLowerCase().trim() === name.toLowerCase().trim());
    if (found !== undefined && row[found] !== "") return row[found];
  }
  return "";
};

// Parse one xlsx row into a canonical record
const parseRow = (r) => ({
  postalCode: pad(getCol(r,
    "code_postal", "code postal", "codepostal", "postalCode", "postal_code",
    "cp", "zip", "zipcode", "code zip"
  )),
  code_insee: String(getCol(r,
    "code_insee", "code insee", "codeinsee", "insee", "code_com", "INSEE_COM"
  ) || "").trim(),
  municipality_name: String(getCol(r,
    "nom_commune", "nom commune", "nomcommune", "municipality_name",
    "commune", "ville", "libelle", "libellé", "nom"
  ) || "").trim(),
  refPrice: Number(getCol(r,
    "price per sqm", "price_per_sqm", "prixm2", "prix_m2", "prix/m2",
    "prix m2", "PrixMoyen", "prix_moyen", "refPrice", "ref_price",
    "prix", "price"
  ) || 0),
});

// ── GET list ─────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = search
      ? {
          $or: [
            { postalCode: { $regex: search, $options: "i" } },
            { municipality_name: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      db.campaignRefPrice.find(query).sort({ postalCode: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      db.campaignRefPrice.countDocuments(query),
    ]);
    return res.json({ success: true, data, total });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST create ───────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { postalCode, refPrice, municipality_name, code_insee } = req.body;
    if (!postalCode || !refPrice)
      return res.status(400).json({ success: false, message: "postalCode et refPrice sont requis." });
    const pc = pad(postalCode);
    const exists = await db.campaignRefPrice.findOne({ postalCode: pc });
    if (exists)
      return res.status(409).json({ success: false, message: `Le code postal ${pc} existe déjà dans la base.` });
    const doc = await db.campaignRefPrice.create({ postalCode: pc, refPrice: Number(refPrice), municipality_name, code_insee });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT update ────────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { refPrice, municipality_name, code_insee } = req.body;
    const doc = await db.campaignRefPrice.findByIdAndUpdate(
      req.params.id,
      { refPrice: Number(refPrice), municipality_name, code_insee },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Enregistrement introuvable." });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    await db.campaignRefPrice.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET export CSV ────────────────────────────────────────────────────────────
router.get("/export/csv", async (req, res) => {
  try {
    const data = await db.campaignRefPrice.find({}).sort({ postalCode: 1 }).lean();
    const header = "code_postal,code_insee,nom_commune,price per sqm\n";
    const rows = data.map((r) => `${r.postalCode},${r.code_insee || ""},${r.municipality_name || ""},${r.refPrice}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=price_per_sqm.csv");
    return res.send(header + rows);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /preview — analyse conflicts before import ──────────────────────────
router.post("/preview", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Fichier manquant." });
    const wb = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    // Expose detected column names for debugging
    const detectedColumns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

    const records = rawRows
      .map(parseRow)
      .filter((r) => r.postalCode && /^\d{2,5}$/.test(r.postalCode) && r.refPrice > 0);

    const postalCodes = records.map((r) => r.postalCode);
    const existing = await db.campaignRefPrice.find({ postalCode: { $in: postalCodes } }).lean();
    const existingSet = new Set(existing.map((e) => e.postalCode));

    const toInsert = records.filter((r) => !existingSet.has(r.postalCode));
    const toUpdate = records.filter((r) => existingSet.has(r.postalCode));

    return res.json({ success: true, total: records.length, toInsert: toInsert.length, toUpdate: toUpdate.length, detectedColumns, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /import — upsert all rows ───────────────────────────────────────────
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Fichier manquant." });
    const wb = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    const records = rows
      .map(parseRow)
      .filter((r) => r.postalCode && /^\d{2,5}$/.test(r.postalCode) && r.refPrice > 0);

    let inserted = 0;
    let updated = 0;
    for (const record of records) {
      const result = await db.campaignRefPrice.findOneAndUpdate(
        { postalCode: record.postalCode },
        { $set: record },
        { upsert: true, new: true }
      );
      if (result) {
        const wasNew = !result.__v; // rough heuristic; use upsertedCount if available
      }
    }

    // Count via simple re-query
    const postalCodes = records.map((r) => r.postalCode);
    const nowInDb = await db.campaignRefPrice.countDocuments({ postalCode: { $in: postalCodes } });

    return res.json({ success: true, processed: records.length, message: `Import terminé : ${records.length} enregistrements traités.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
