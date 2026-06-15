const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
// Defer requiring DB/models until runtime to allow importing mapping helpers
// without initializing a DB connection (useful for tests).

const defaultKeyMap = {
  id_mutation: 'id_mutation',
  date_mutation: 'mutation_date',
  numero_disposition: 'provision_number',
  nature_mutation: 'nature_mutation',
  valeur_fonciere: 'land_value',
  adresse_numero: 'address_number',
  adresse_suffixe: 'address_suffix',
  adresse_nom_voie: 'address_channel_name',
  adresse_code_voie: 'channel_code_address',
  code_postal: 'postal_code',
  code_commune: 'community_code',
  nom_commune: 'community_name',
  code_departement: 'department_code',
  ancien_code_commune: 'old_community_code',
  ancien_nom_commune: 'old_community_name',
  id_parcelle: 'plot_id',
  ancien_id_parcelle: 'old_plot_id',
  numero_volume: 'volume_number',
  lot1_numero: 'lot1_number',
  lot1_surface_carrez: 'lot1_surface_carrez',
  lot2_numero: 'lot2_number',
  lot2_surface_carrez: 'lot2_surface_carrez',
  lot3_numero: 'lot3_number',
  lot3_surface_carrez: 'lot3_surface_carrez',
  lot4_numero: 'lot4_number',
  lot4_surface_carrez: 'lot4_surface_carrez',
  lot5_numero: 'lot5_number',
  lot5_surface_carrez: 'lot5_surface_carrez',
  nombre_lots: 'number_lots',
  code_type_local: 'local_type_code',
  type_local: 'local_type',
  surface_reelle_bati: 'real_built_surface',
  nombre_pieces_principales: 'number_of_main_pieces',
  code_nature_culture: 'code_nature_culture',
  nature_culture: 'nature_culture',
  code_nature_culture_speciale: 'code_nature_culture_special',
  nature_culture_speciale: 'nature_culture_special',
  surface_terrain: 'land_surface',
  longitude: 'longitude',
  latitude: 'latitude',
};

function normalizeDate(value) {
  if (value == null) return null;
  if (!isNaN(value)) {
    const serial = parseFloat(value);
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    return date_info.toISOString().split('T')[0];
  }
  return String(value).trim();
}

function toNumberOrNull(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function mapRowToDoc(lower, keyMap = defaultKeyMap) {
  const doc = {};
  for (const [csvKey, modelKey] of Object.entries(keyMap)) {
    let value = lower[csvKey] !== undefined ? lower[csvKey] : null;
    if (modelKey === 'mutation_date' && value) value = normalizeDate(value);
    else value = value !== null ? String(value) : null;
    doc[modelKey] = value;
  }

  // derive numeric and geo fields
  doc.land_value_num = toNumberOrNull(doc.land_value);
  doc.lot1_surface_carrez_num = toNumberOrNull(doc.lot1_surface_carrez);
  doc.real_built_surface_num = toNumberOrNull(doc.real_built_surface);
  doc.number_of_main_pieces_num = toNumberOrNull(doc.number_of_main_pieces);
  doc.land_surface_num = toNumberOrNull(doc.land_surface);
  doc.longitude_num = toNumberOrNull(doc.longitude);
  doc.latitude_num = toNumberOrNull(doc.latitude);

  if (doc.latitude && doc.longitude) {
    const lat = parseFloat(doc.latitude);
    const lng = parseFloat(doc.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      doc.location = { type: 'Point', coordinates: [lng, lat] };
    }
  }

  // transaction year guess
  if (doc.mutation_date) {
    const y = new Date(doc.mutation_date).getFullYear();
    if (!Number.isNaN(y)) doc.year = y;
  }

  doc.is_imported = 'Y';
  return doc;
}

async function importFromDirectory(rootDir, years = [], options = {}) {
  const db = require('../models');
  const Transaction = db.pastTransaction;
  const batchSize = options.batchSize || 5000;
  const insertOpts = { ordered: false };
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  const filesToProcess = [];

  for (const year of years) {
    // Support directories named like "Past Transaction 2014" or just "2014"
    const candidateDirs = [];
    const direct = path.join(rootDir, String(year));
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) candidateDirs.push(direct);

    // scan rootDir children to find folders that include the year string
    try {
      const children = fs.readdirSync(rootDir);
      for (const child of children) {
        const childPath = path.join(rootDir, child);
        if (fs.existsSync(childPath) && fs.statSync(childPath).isDirectory()) {
          if (child.toLowerCase().includes(String(year).toLowerCase())) {
            if (!candidateDirs.includes(childPath)) candidateDirs.push(childPath);
          }
        }
      }
    } catch (e) {
      // ignore
    }

    for (const yearDir of candidateDirs) {
      const list = fs.readdirSync(yearDir);
      for (const f of list) {
        const ext = path.extname(f).toLowerCase();
        if (ext === '.csv' || ext === '.txt') filesToProcess.push(path.join(yearDir, f));
      }
    }
  }

  let totalInserted = 0;

  for (let idx = 0; idx < filesToProcess.length; idx++) {
    const filePath = filesToProcess[idx];
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath).pipe(csv());
      const bulkOps = [];

      stream.on('data', (row) => {
        // normalize keys
        const lower = Object.keys(row).reduce((acc, key) => {
          acc[key.trim().toLowerCase()] = row[key];
          return acc;
        }, {});

        const doc = {};
        for (const [csvKey, modelKey] of Object.entries(defaultKeyMap)) {
          let value = lower[csvKey] !== undefined ? lower[csvKey] : null;
          if (modelKey === 'mutation_date' && value) value = normalizeDate(value);
          else value = value !== null ? String(value) : null;
          doc[modelKey] = value;
        }

        // derive numeric and geo fields
        doc.land_value_num = toNumberOrNull(doc.land_value);
        doc.lot1_surface_carrez_num = toNumberOrNull(doc.lot1_surface_carrez);
        doc.real_built_surface_num = toNumberOrNull(doc.real_built_surface);
        doc.number_of_main_pieces_num = toNumberOrNull(doc.number_of_main_pieces);
        doc.land_surface_num = toNumberOrNull(doc.land_surface);
        doc.longitude_num = toNumberOrNull(doc.longitude);
        doc.latitude_num = toNumberOrNull(doc.latitude);

        if (doc.latitude && doc.longitude) {
          const lat = parseFloat(doc.latitude);
          const lng = parseFloat(doc.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            doc.location = { type: 'Point', coordinates: [lng, lat] };
          }
        }

        // transaction year guess
        if (doc.mutation_date) {
          const y = new Date(doc.mutation_date).getFullYear();
          if (!Number.isNaN(y)) doc.year = y;
        }

        doc.is_imported = 'Y';

        bulkOps.push({ insertOne: { document: doc } });

        if (bulkOps.length >= batchSize) {
          stream.pause();
          Transaction.bulkWrite(bulkOps.splice(0), insertOpts)
            .then(result => {
              totalInserted += (result.insertedCount || 0);
              stream.resume();
            })
            .catch(err => {
              console.error('bulkWrite error:', err.message);
              stream.resume();
            });
        }
      });

      stream.on('end', async () => {
        try {
          if (bulkOps.length) {
            const result = await Transaction.bulkWrite(bulkOps, insertOpts);
            totalInserted += (result.insertedCount || 0);
          }
          console.log(`Finished file ${filePath}. Total inserted so far: ${totalInserted}`);
          if (onProgress) {
            try {
              const percent = Math.round(((idx + 1) / filesToProcess.length) * 100);
              onProgress({ file: filePath, fileIndex: idx + 1, totalFiles: filesToProcess.length, inserted: totalInserted, percent });
            } catch (e) { /* ignore progress errors */ }
          }
          resolve();
        } catch (err) {
          console.error('final bulkWrite error:', err.message);
          resolve();
        }
      });

      stream.on('error', (err) => {
        console.error('Stream error on', filePath, err.message);
        resolve();
      });
    });
  }

  return { inserted: totalInserted };
}

module.exports = { importFromDirectory, mapRowToDoc, defaultKeyMap };
