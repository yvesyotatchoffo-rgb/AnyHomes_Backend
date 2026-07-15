/**
 * Seed blog articles from Markdown files into MongoDB.
 *
 * Usage:
 *   node scripts/seed_blogs.js             # insert all (skip duplicates)
 *   node scripts/seed_blogs.js --dry-run  # parse & log only, no DB writes
 *   node scripts/seed_blogs.js --force     # re-insert even if title exists
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const db = require("../app/models");

const BLOG_DIR =
  "/Users/yvesyotatchoffo/Mon Drive/Anyhomes/05_Marketing/Blog posts/Lancement";

const SYSTEM_USER_ID = "69faed55774ef762dbf71a99";

const PERSONA_MAP = {
  selling: "6a3d9d3330c2d214d03c7723",
  renting: "6a3d9d4c30c2d214d03c7731",
  owning: "6a3d9d5430c2d214d03c773a",
  buying: "6a3d9d5b30c2d214d03c7742",
  financing: "6a3d9d6130c2d214d03c7749",
  investing: "6a3d9d7530c2d214d03c7750",
};

function mapPersonaKey(personaLabel) {
  const p = (personaLabel || "").toLowerCase();
  if (
    p.includes("acheteur") || p.includes("achat") || p.includes("primo") ||
    p.includes("futur propri") || p.includes("particulier h")
  ) return "buying";
  if (p.includes("financ") || p.includes("emprunt") || p.includes("crédit")) return "financing";
  if (p.includes("invest") || p.includes("rendement") || p.includes("locatif")) return "investing";
  if (p.includes("locataire") || p.includes("louer") || p.includes("location")) return "renting";
  if (
    p.includes("vendeur") || p.includes("vendre") ||
    p.includes("propriétaire en réflexion") || p.includes("propriétaire autonome")
  ) return "selling";
  if (
    p.includes("propriétaire occupant") || p.includes("gérer") ||
    p.includes("gestion") || p.includes("owner")
  ) return "owning";
  return "selling";
}

function shortenTheme(theme) {
  const words = theme.trim().split(/\s+/);
  if (words.length <= 4) return theme.trim();
  const filler = new Set([
    "de", "du", "des", "le", "la", "les", "un", "une",
    "et", "à", "pour", "dans", "sur", "comment", "pourquoi",
    "est", "se", "son", "sa", "ses",
  ]);
  const meaningful = words.filter(
    (w, i) => !filler.has(w.toLowerCase()) || i >= words.length - 2
  );
  const result = meaningful.slice(-4).join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function getUnsplashImage(query) {
  return new Promise((resolve) => {
    const keyword = encodeURIComponent(query);
    const url = `https://source.unsplash.com/1600x900/?${keyword}`;
    const req = https.request(url, { method: "GET", timeout: 8000 }, (res) => {
      if (res.headers.location) resolve(res.headers.location);
      else resolve(url);
      res.resume();
    });
    req.on("error", () => resolve(url));
    req.on("timeout", () => { req.destroy(); resolve(url); });
    req.end();
  });
}

function calculateDuration(text) {
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(wordCount / 200));
  return `${minutes} min`;
}

function generateMetaTitle(title) {
  let meta = title;
  if (meta.length > 60) meta = meta.substring(0, 57) + "...";
  return meta;
}

function generateMetaDescription(content) {
  const lines = content.split("\n");
  let firstPara = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("**") &&
      !trimmed.startsWith("-") && !trimmed.startsWith("Encart")
    ) {
      firstPara = trimmed;
      break;
    }
  }
  if (!firstPara) firstPara = content.substring(0, 160);
  if (firstPara.length > 160) firstPara = firstPara.substring(0, 157) + "...";
  return firstPara;
}

function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const articles = [];
  const parts = content.split(/^## Article\s+\d+\s*—\s*/m);

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].trim();
    if (!block) continue;

    const newlineIdx = block.indexOf("\n");
    const title = block.substring(0, newlineIdx).trim();
    // Normalize NFD (decomposed accents) to NFC (composed) for reliable matching
    const rest = block.substring(newlineIdx + 1).trim().normalize("NFC");

    const personaMatch = rest.match(/\*\*Persona\s*:\s*\*\*\s*(.+)/i);
    const personaLabel = personaMatch ? personaMatch[1].trim() : "";

    const themeMatch = rest.match(/\*\*Th[èeé]me\s*:\s*\*\*\s*(.+)/i);
    const theme = themeMatch ? themeMatch[1].trim() : "";

    const urlMatch = rest.match(/\*\*URL\s*\/.*:\s*\*\*\s*(.+)/i);
    const imageHint = urlMatch ? urlMatch[1].trim() : "";

    let body = rest
      .replace(/\*\*Persona\s*:\s*\*\*\s*.+\n?/i, "")
      .replace(/\*\*Th[èeé]me\s*:\s*\*\*\s*.+\n?/i, "")
      .replace(/\*\*URL\s*\/.*:\s*\*\*\s*.+\n?/i, "")
      .trim();
    body = body.replace(/\n---\s*$/, "").trim();

    articles.push({ title, personaLabel, theme, imageHint, body });
  }
  return articles;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log(`\n=== Seed Blog Articles ===`);
  console.log(`Dry run: ${dryRun}, Force: ${force}\n`);

  const SKIP_FILES = new Set([
    "lot9_anyhomes_articles.md",
    "lot10_anyhomes_articles.md",
  ]);

  let files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md") && !SKIP_FILES.has(f))
    .sort()
    .map((f) => path.join(BLOG_DIR, f));

  console.log(`Found ${files.length} markdown files:`);
  files.forEach((f) => console.log(`  - ${path.basename(f)}`));

  let allArticles = [];
  const seenTitles = new Set();
  for (const file of files) {
    const articles = parseMarkdownFile(file);
    console.log(`\nParsed ${articles.length} articles from ${path.basename(file)}`);
    for (const art of articles) {
      if (seenTitles.has(art.title)) {
        console.log(`  [SKIP DUP] "${art.title}" already seen`);
        continue;
      }
      seenTitles.add(art.title);
      allArticles.push(art);
    }
  }

  console.log(`\nTotal unique articles to process: ${allArticles.length}\n`);

  if (!dryRun) {
    console.log("Connecting to DB...");
    await db.mongoose.connect(db.url, {});
    console.log("Connected.\n");
  }

  const topicCache = {};
  if (!dryRun) {
    const existingTopics = await db.persona.db.collection("trainingtopics").find({}).toArray();
    for (const t of existingTopics) {
      const personaId = t.persona ? t.persona.toString() : "none";
      topicCache[`${personaId}::${t.name}`] = t._id;
    }
    console.log(`Loaded ${Object.keys(topicCache).length} existing training topics into cache.`);
  }

  let inserted = 0, skipped = 0, errors = 0;

  for (const art of allArticles) {
    try {
      const personaKey = mapPersonaKey(art.personaLabel);
      const personaId = PERSONA_MAP[personaKey];
      const topicName = shortenTheme(art.theme);

      console.log(`\n--- Article: "${art.title}"`);
      console.log(`    Persona: "${art.personaLabel}" -> ${personaKey} (${personaId})`);
      console.log(`    Thème:   "${art.theme}" -> "${topicName}"`);

      if (dryRun) {
        console.log(`    [DRY RUN] Would insert this article.`);
        continue;
      }

      if (!force) {
        const existing = await db.blogs.findOne({ title: art.title, isDeleted: false });
        if (existing) {
          console.log(`    [SKIP] Blog already exists`);
          skipped++;
          continue;
        }
      }

      let topicId = topicCache[`${personaId}::${topicName}`];
      if (!topicId) {
        const existingTopic = await db.persona.db
          .collection("trainingtopics")
          .findOne({ name: topicName, persona: personaId });
        if (existingTopic) {
          topicId = existingTopic._id;
        } else {
          const newTopic = await db.persona.db.collection("trainingtopics").insertOne({
            name: topicName,
            persona: personaId,
            isActive: true,
            isDeleted: false,
            addedBy: SYSTEM_USER_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          topicId = newTopic.insertedId;
          console.log(`    [CREATED] Training topic: "${topicName}" (${topicId})`);
        }
        topicCache[`${personaId}::${topicName}`] = topicId;
      }

      const imageQuery = art.imageHint
        ? art.imageHint.split(/\s+/).slice(0, 3).join(",")
        : "real estate,home,property";
      console.log(`    Fetching Unsplash image for: "${imageQuery}"...`);
      const bannerUrl = await getUnsplashImage(imageQuery);
      console.log(`    Banner: ${bannerUrl}`);

      const duration = calculateDuration(art.body);
      console.log(`    Duration: ${duration}`);

      const metaTitle = generateMetaTitle(art.title);
      const metaDescription = generateMetaDescription(art.body);

      const blogDoc = {
        title: art.title,
        title_fr: art.title,
        banner: bannerUrl,
        images: [bannerUrl],
        description: art.body,
        description_fr: art.body,
        metaTitle,
        metaDescription,
        duration,
        status: "active",
        addedBy: SYSTEM_USER_ID,
        blogOwner: SYSTEM_USER_ID,
        isDeleted: false,
        categoryId: personaId,
        subCategoryId: topicId,
      };

      const created = await db.blogs.create(blogDoc);
      console.log(`    [INSERTED] Blog ID: ${created._id}`);
      inserted++;
    } catch (err) {
      console.error(`    [ERROR] ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total articles processed: ${allArticles.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (!dryRun) {
    await db.mongoose.disconnect();
    console.log("\nDisconnected from DB.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});