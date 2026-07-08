const XLSX = require('xlsx');
const axios = require('axios');

const INPUT = '/Users/yvesyotatchoffo/Mon Drive/Anyhomes/01_Product/01_MVP/Code/Backend/api_bookaro-lovepreet/Blog_Posts/Zw Blog 180925.xlsx';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
if (!DEEPL_API_KEY) {
  console.error('ERROR : Clé API DeepL manquante.');
  console.error('Exporte-la avec : export DEEPL_API_KEY=votre_cle');
  console.error('Ou obtiens une clé gratuite sur https://www.deepl.com/fr/pro-api');
  process.exit(1);
}

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

async function translateBatch(texts, targetLang = 'FR') {
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (!text || text.trim().length < 10) {
      results.push(text);
      continue;
    }
    try {
      const res = await axios.post(DEEPL_URL,
        { text: [text], target_lang: targetLang, tag_handling: 'xml' },
        { headers: { Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}` }, timeout: 30000 }
      );
      results.push(res.data.translations[0].text);
    } catch (err) {
      console.error(`Erreur DeepL pour bloc ${i}:`, err.response?.data || err.message);
      results.push(text);
    }
    if ((i + 1) % 5 === 0) console.log(`  Traduits ${i + 1}/${texts.length} textes`);
  }
  return results;
}

function splitIntoChunks(text, maxBytes = 1200) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  for (const p of paragraphs) {
    const test = current + (current ? '\n\n' : '') + p;
    if (Buffer.byteLength(test, 'utf-8') > maxBytes && current) {
      chunks.push(current);
      current = p;
    } else {
      current = test;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function main() {
  console.log('Lecture du fichier...');
  const wb = XLSX.readFile(INPUT);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

  console.log(`${data.length} articles trouvés.`);

  const BATCH_SIZE = 20;
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, data.length);
    const batchNum = batch + 1;
    const outputFile = `/Users/yvesyotatchoffo/Mon Drive/Anyhomes/01_Product/01_MVP/Code/Backend/api_bookaro-lovepreet/Blog_Posts/FR_Batch_${batchNum}.xlsx`;

    console.log(`\n=== Lot ${batchNum}/${totalBatches} (articles ${start + 1}-${end}) ===`);

    const batchData = data.slice(start, end);
    const contentToTranslate = batchData.map(r => r['Post content'] || '');
    const subtitleToTranslate = batchData.map(r => r.Subtitle || '');

    // Count chars for DeepL limit
    const totalChars = contentToTranslate.reduce((sum, t) => sum + t.length, 0);
    console.log(`  Caractères à traduire : ~${totalChars.toLocaleString('fr-FR')}`);

    console.log('  Traduction des contenus...');
    const translatedContent = await translateBatch(contentToTranslate);

    console.log('  Traduction des sous-titres...');
    const translatedSubtitles = await translateBatch(subtitleToTranslate);

    const headers = [
      'REF', 'Url', 'Titre EN', 'Sous-titre EN', 'Catégorie',
      'Tags', 'Date publication', 'Temps lecture', 'Contenu EN',
      'Titre FR', 'Sous-titre FR', 'Catégorie FR', 'Tags FR', 'Contenu FR'
    ];

    const rows = [headers];
    for (let i = 0; i < batchData.length; i++) {
      const r = batchData[i];
      rows.push([
        r.REF, r.Url, r.Title, r.Subtitle, r.Category,
        r.Tags, r['Publication date'], r['Reading time'], r['Post content'],
        r.Title, // Titre FR (à améliorer manuellement si besoin)
        translatedSubtitles[i],
        r.Category, // Catégorie FR (à mapper)
        r.Tags,
        translatedContent[i],
      ]);
    }

    const newWs = XLSX.utils.aoa_to_sheet(rows);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, `Batch_${batchNum}`);
    XLSX.writeFile(newWb, outputFile);
    console.log(`  ✓ Fichier créé : FR_Batch_${batchNum}.xlsx`);
  }

  console.log('\n=== TERMINÉ ===');
}

main().catch(console.error);
