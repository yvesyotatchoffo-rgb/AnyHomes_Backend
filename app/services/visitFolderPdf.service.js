const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "../../public");

const imgSrc = (file) => {
  if (!file) return "";
  const absPath = path.join(PUBLIC_DIR, "img", file);
  try {
    const ext = path.extname(file).toLowerCase().replace(".", "");
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/webp";
    const data = fs.readFileSync(absPath);
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch (e) {
    return "";
  }
};

const STYLES = `
  @page { margin: 0; size: A4 portrait; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #2F3A46; background: #fff; }
  .page { }
  .page { }
  .page-break { break-before: page; height: 0; margin: 0; padding: 0; }
  .cover-image { width: 100%; height: 130mm; object-fit: cover; display: block; }
  .cover-body { padding: 30px 50px 20px; display: flex; justify-content: space-between; align-items: flex-start; }
  .cover-info { flex: 1; }
  .cover-label { color: #976DD0; font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .cover-title { font-size: 28px; font-weight: 800; color: #2F3A46; margin-bottom: 4px; line-height: 1.1; }
  .cover-address { font-size: 15px; color: #6B7280; margin-bottom: 2px; }
  .cover-contact { font-size: 14px; color: #2F3A46; font-weight: 600; }
  .cover-price { font-size: 34px; font-weight: 800; color: #976DD0; text-align: right; white-space: nowrap; flex-shrink: 0; margin-left: 30px; }
  .cover-divider { height: 1px; background: #E5E7EB; margin: 0 50px; }
  .cover-synthese { padding: 20px 50px 30px; }
  .synthese-title { font-size: 16px; font-weight: 800; color: #2F3A46; margin-bottom: 14px; }
  .synthese-grid { display: flex; flex-wrap: wrap; gap: 6px 20px; }
  .synthese-item { font-size: 14px; color: #2F3A46; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
  .content { padding: 40px 50px; }
  .section-title { font-size: 22px; font-weight: 800; color: #2F3A46; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 3px solid #976DD0; }
  .section-subtitle { font-size: 14px; color: #976DD0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
  .field-row { display: flex; align-items: center; margin-bottom: 12px; }
  .field-icon { width: 28px; font-size: 18px; color: #976DD0; flex-shrink: 0; }
  .field-label { font-size: 13px; color: #6B7280; width: 120px; flex-shrink: 0; }
  .field-value { font-size: 15px; font-weight: 600; color: #2F3A46; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .stat-box { text-align: center; padding: 16px 8px; background: #F9FAFB; border-radius: 10px; }
  .stat-icon { font-size: 24px; margin-bottom: 6px; }
  .stat-value { font-size: 18px; font-weight: 700; color: #2F3A46; }
  .stat-label { font-size: 12px; color: #6B7280; margin-top: 2px; }
  .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .photo-grid img { width: 100%; height: 180px; object-fit: cover; border-radius: 8px; }
  .editable-block { background: #F3ECFF; border-radius: 10px; padding: 20px; margin-top: 16px; }
  .editable-block h3 { font-size: 15px; color: #976DD0; font-weight: 700; margin-bottom: 8px; }
  .editable-block p { font-size: 14px; color: #2F3A46; line-height: 1.6; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin: 3px; }
  .badge-purple { background: #EDE9FE; color: #5B21B6; }
  .badge-green { background: #D1FAE5; color: #065F46; }
  .dpe-box { display: inline-flex; flex-direction: column; align-items: center; padding: 20px 30px; background: #F9FAFB; border-radius: 12px; margin-right: 16px; }
  .dpe-letter { font-size: 42px; font-weight: 800; }
  .dpe-label { font-size: 11px; color: #6B7280; text-transform: uppercase; }
  .next-steps { display: flex; justify-content: center; gap: 30px; margin-top: 30px; }
  .step-card { text-align: center; padding: 20px; width: 160px; }
  .step-number { width: 40px; height: 40px; border-radius: 50%; background: #976DD0; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; margin: 0 auto 10px; }
  .step-title { font-size: 14px; font-weight: 700; color: #2F3A46; margin-bottom: 4px; }
  .step-desc { font-size: 12px; color: #6B7280; line-height: 1.4; }
  .contact-bar { text-align: center; padding: 20px; background: #F9FAFB; border-radius: 12px; margin-top: 20px; }
  .empty-badge { color: #9CA3AF; font-size: 13px; font-style: italic; }
`;

const ICONS = {
  type: "🏠", surface: "📐", rooms: "🛏", bedrooms: "🛌",
  bathroom: "🚿", toilets: "🚽", propertyFloor: "🏢", building: "🏗",
  situation: "📍", landSurface: "🌳", usedAs: "📋", price: "💰",
  pricePerSqm: "📊", referencePrice: "📈", propertyCharges: "📄",
  energyConsumption: "⚡", energy_efficient: "🔋", emissions: "🌫️",
  address: "📍", city: "🏙️", garden: "🌿", balcony: "🪟",
  parking: "🅿️", elevator: "🛗", cellar: "🪜", terrace: "🏞️",
  pool: "🏊", gym: "🏋️", security: "🛡️", intercom: "📞",
  caretaker: "👨‍💼", heating: "🔥", garage: "🚗", dpe: "📊", ges: "🌱",
};

function buildHtml(snapshot, destination, selectedPhotos, property) {
  const { cover, summary, media, environment, keyFigures, valueHistory, nextSteps, engagement } = snapshot;

  const coverPhoto = selectedPhotos?.[0]?.fileName
    ? imgSrc(selectedPhotos[0].fileName)
    : property?.images?.[0]?.file
      ? imgSrc(property.images[0].file)
      : null;

  const coverFields = cover.fields || [];
  const getVal = (key) => coverFields.find((f) => f.key === key)?.value || "";
  const getName = (key) => coverFields.find((f) => f.key === key)?.label || "";
  const summaryFields = summary.fields || [];
  const keyFigFields = keyFigures.fields || [];

  const priceField = keyFigFields.find((f) => f.key === "price");
  const priceValue = priceField?.visible ? priceField.value : "";
  const surfaceField = summaryFields.find((f) => f.key === "surface");
  const roomsField = summaryFields.find((f) => f.key === "rooms");
  const bedroomsField = summaryFields.find((f) => f.key === "bedrooms");
  const bathroomField = summaryFields.find((f) => f.key === "bathroom");
  const floorField = summaryFields.find((f) => f.key === "propertyFloor");
  const buildingField = summaryFields.find((f) => f.key === "building");

  const amenityLabels = property?.amenityLabels || [];
  const dpeLabel = keyFigFields.find((f) => f.key === "energy_efficient");
  const gesLabel = keyFigFields.find((f) => f.key === "emission_efficient");

  const summaryHtml = summaryFields
    .filter((f) => f.visible)
    .map(
      (f) => `
    <div class="stat-box">
      <div class="stat-icon">${ICONS[f.key] || "•"}</div>
      <div class="stat-value">${f.value}</div>
      <div class="stat-label">${f.label}</div>
    </div>`
    )
    .join("");

  const keyFigHtml = keyFigFields
    .filter((f) => f.visible)
    .map(
      (f) => `
    <div class="stat-box">
      <div class="stat-value" style="color:#976DD0">${f.value}</div>
      <div class="stat-label">${f.label}</div>
    </div>`
    )
    .join("");

  const photosHtml = media.visible
    ? (media.photos || [])
        .map(
          (p) =>
            `<img src="${imgSrc(p.fileName || p.file)}" alt="${p.originalname || "Photo"}" onerror="this.style.display='none'" />`
        )
        .join("")
    : `<p class="empty-badge">Aucune photo sélectionnée</p>`;

  const envHtml = (environment.fields || [])
    .filter((f) => f.visible)
    .map(
      (f) => `
    <div class="field-row">
      <span class="field-icon">${ICONS[f.key] || "•"}</span>
      <span class="field-label">${f.label}</span>
      <span class="field-value">${f.value}</span>
    </div>`
    )
    .join("");

  const valueHistHtml = (valueHistory.sections || [])
    .map(
      (sec) => `
    <div style="margin-bottom:24px">
      <h3 style="font-size:16px;font-weight:700;color:#2F3A46;margin-bottom:10px">${sec.title}</h3>
      ${(sec.items || [])
        .map(
          (item) =>
            `<div class="field-row">
              <span class="field-icon">•</span>
              <span class="field-value">${item.title || item.type || item.description || ""}${item.year ? " (" + item.year + ")" : ""}${item.price ? " — " + item.price + " €" : ""}</span>
            </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  const nextHtml = (nextSteps.fields || [])
    .filter((f) => f.visible)
    .map(
      (f, i) => `
    <div class="step-card">
      <div class="step-number">${i + 1}</div>
      <div class="step-title">${f.label}</div>
      <div class="step-desc">${f.value}</div>
    </div>`
    )
    .join("");

  const selectedDocs = snapshot.selectedDocuments || [];
  const allDocs = snapshot.allDocuments || [];
  const docsHtml = selectedDocs.length > 0 ? `
    <div style="margin-top:20px">
      <h3 style="font-size:16px;font-weight:700;color:#2F3A46;margin-bottom:10px">Documents et justificatifs disponibles à la demande</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${selectedDocs.map(d => `<span class="badge badge-green" style="font-size:13px;padding:6px 14px">📄 ${d.originalname}</span>`).join("")}
      </div>
    </div>` : allDocs.length === 0 ? `
    <div style="margin-top:20px;padding:16px;background:#F9FAFB;border-radius:10px;text-align:center">
      <p style="font-size:14px;color:#6B7280">Aucun document dans votre dossier vendeur.</p>
      <p style="font-size:13px;color:#976DD0;margin-top:4px">Mettez à jour votre <strong>dossier vendeur</strong> pour ajouter des justificatifs.</p>
    </div>` : "";

  const engVisible = engagement?.visible && (engagement?.views || engagement?.likes || engagement?.shares || engagement?.followers);
  const engHtml = engVisible ? `
    <div style="margin-top:20px;background:#F3ECFF;border-radius:12px;padding:20px">
      <h3 style="font-size:16px;font-weight:700;color:#2F3A46;margin-bottom:6px">Ce bien attire déjà l'attention</h3>
      <p style="font-size:13px;color:#6B7280;margin-bottom:12px">Voici l'activité constatée autour de ce bien depuis sa mise en ligne.</p>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        ${engagement?.views ? `<div style="text-align:center"><div style="font-size:24px;font-weight:800;color:#976DD0">${engagement.views}</div><div style="font-size:12px;color:#6B7280">Vues</div></div>` : ""}
        ${engagement?.likes ? `<div style="text-align:center"><div style="font-size:24px;font-weight:800;color:#976DD0">${engagement.likes}</div><div style="font-size:12px;color:#6B7280">Likes</div></div>` : ""}
        ${engagement?.shares ? `<div style="text-align:center"><div style="font-size:24px;font-weight:800;color:#976DD0">${engagement.shares}</div><div style="font-size:12px;color:#6B7280">Partages</div></div>` : ""}
        ${engagement?.followers ? `<div style="text-align:center"><div style="font-size:24px;font-weight:800;color:#976DD0">${engagement.followers}</div><div style="font-size:12px;color:#6B7280">Abonnés</div></div>` : ""}
      </div>
    </div>` : "";

  const syntheseItems = [];
  if (surfaceField?.visible) syntheseItems.push({ icon: ICONS.surface || "📐", text: surfaceField.value });
  if (roomsField?.visible) syntheseItems.push({ icon: ICONS.rooms || "🛏", text: roomsField.value + " pièces" });
  if (bedroomsField?.visible) syntheseItems.push({ icon: ICONS.bedrooms || "🛌", text: bedroomsField.value + " chbres" });
  if (bathroomField?.visible) syntheseItems.push({ icon: ICONS.bathroom || "🚿", text: bathroomField.value + " sdb" });
  if (floorField?.visible) syntheseItems.push({ icon: ICONS.propertyFloor || "🏢", text: floorField.value + "e" });
  if (buildingField?.visible) syntheseItems.push({ icon: ICONS.building || "🏗", text: buildingField.value });
  if (property?.situation?.length > 0) syntheseItems.push({ icon: ICONS.situation || "📍", text: Array.isArray(property.situation) ? property.situation.join(", ") : property.situation });
  amenityLabels.forEach(a => syntheseItems.push({ icon: ICONS[a.toLowerCase().replace(/[^a-z]/g, "")] || "•", text: a }));
  if (dpeLabel?.visible) syntheseItems.push({ icon: ICONS.dpe || "📊", text: "DPE " + dpeLabel.value });
  if (gesLabel?.visible) syntheseItems.push({ icon: ICONS.ges || "🌱", text: "GES " + gesLabel.value });

  const syntheseHtml = syntheseItems.length > 0 ? `
    <div class="cover-divider"></div>
    <div class="cover-synthese">
      <div class="synthese-title">Synthèse</div>
      <div class="synthese-grid">
        ${syntheseItems.map(item => `<span class="synthese-item"><span style="font-size:16px;margin-right:4px">${item.icon}</span> ${item.text}</span>`).join("")}
      </div>
    </div>` : "";

  const surfaceStr = surfaceField?.visible ? surfaceField.value : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${STYLES}</style></head>
<body>
  <!-- PAGE 1: COVER -->
  <div class="page">
    ${coverPhoto ? `<img class="cover-image" src="${coverPhoto}" />` : '<div style="height:130mm;background:linear-gradient(135deg,#976DD0,#7d55b5)"></div>'}
    <div class="cover-body">
      <div class="cover-info">
        <div class="cover-label">Dossier de visite</div>
        <div class="cover-title">${getVal("propertyTitle")}</div>
        <div class="cover-address">${getVal("address") ? getVal("address") + ", " : ""}${getVal("zipcode")} ${getVal("city")}</div>
        <div class="cover-contact">${property?.username || ""}${property?.phoneNumber ? " — " + property.phoneNumber : ""}</div>
      </div>
      ${priceValue ? `<div class="cover-price">${priceValue}</div>` : ""}
    </div>
    ${syntheseHtml}
    ${(snapshot.valorizationItems || []).length > 0 ? `
      <div class="cover-divider"></div>
      <div class="cover-synthese">
        <div class="synthese-title">Éléments de valorisation</div>
        <div class="synthese-grid">
          ${snapshot.valorizationItems.map(v => `<span class="synthese-item" style="color:#065F46"><span style="font-size:16px;margin-right:4px">✓</span> ${v.label || v}</span>`).join("")}
        </div>
      </div>` : ""}
  </div>
  <div class="page-break"></div>

  <!-- PAGE 2: SUMMARY -->
  <div class="page">
    <div class="content">
      <div class="section-title">Le bien en bref</div>
      <div class="grid-4">${summaryHtml}</div>
      ${property?.content ? `<div class="editable-block" style="margin-top:24px"><h3>À retenir</h3><p>${property.content}</p></div>` : ""}
    </div>
  </div>
  <div class="page-break"></div>

  <!-- PAGE 3: MEDIA -->
  <div class="page">
    <div class="content">
      <div class="section-title">Revivre la visite</div>
      <div class="photo-grid">${photosHtml}</div>
      ${snapshot.visitHighlights ? `<div class="editable-block"><h3>Ce qui marque la visite</h3><p>${snapshot.visitHighlights}</p></div>` : ""}
    </div>
  </div>
  <div class="page-break"></div>

  <!-- PAGE 4: ENVIRONMENT -->
  <div class="page">
    <div class="content">
      <div class="section-title">Cadre de vie</div>
      ${envHtml}
      ${snapshot.neighborhood ? `<div class="editable-block"><h3>Vivre dans ce quartier</h3><p>${snapshot.neighborhood}</p></div>` : ""}
    </div>
  </div>
  <div class="page-break"></div>

  <!-- PAGE 5: KEY FIGURES -->
  <div class="page">
    <div class="content">
      <div class="section-title">Données techniques et économiques</div>
      <div class="grid-3">${keyFigHtml}</div>
      ${(property.linkedSchools || []).length > 0 ? `
        <div style="margin-top:24px">
          <h3 style="font-size:16px;font-weight:700;color:#2F3A46;margin-bottom:10px">Écoles à proximité</h3>
          ${property.linkedSchools.map(s => `<div class="badge badge-purple">${s.EstablishmentName || s.type}</div>`).join("")}
        </div>` : ""}
      ${docsHtml}
    </div>
  </div>
  <div class="page-break"></div>

  <!-- PAGE 6: VALUE HISTORY -->
  <div class="page">
    <div class="content">
      <div class="section-title">Historique de valorisation</div>
      ${valueHistHtml || '<p class="empty-badge">Aucune donnée d\'historique disponible</p>'}
      ${engHtml}
    </div>
  </div>
  <div class="page-break"></div>

  <!-- PAGE 7: NEXT STEPS -->
  <div class="page">
    <div class="content">
      <div class="section-title">Continuer dans AnyHomes</div>
      <div class="next-steps">${nextHtml}</div>
      <div class="contact-bar">
        <p style="font-size:14px;color:#2F3A46;font-weight:600">${property?.username || "Le propriétaire"}</p>
        <p style="font-size:13px;color:#6B7280">${property?.phoneNumber || ""}${property?.phoneNumber && property?.email ? " | " : ""}${property?.email || ""}</p>
        <p style="font-size:12px;color:#976DD0;margin-top:8px">Document généré via AnyHomes — ${new Date().toLocaleDateString("fr-FR")}</p>
      </div>
    </div>
  </div>
</body></html>`;
}

async function generatePdf(html, outputPath) {
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "load" });
    await page.waitForSelector("img", { timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { buildHtml, generatePdf };
