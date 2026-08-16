// services/visitFolderPdf/engine/generatePdf.js
const puppeteer = require("puppeteer");

async function generatePdf(html, outputPath) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "load" });

    await page.waitForSelector("img", { timeout: 5000 }).catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
