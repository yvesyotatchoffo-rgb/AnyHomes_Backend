// services/visitFolderPdf/components/tables.js
const { icon } = require("../utils/icons");

function figureBox(title, rows = []) {
  if (!rows.length) return "";

  return `
    <div>
      <div class="figure-title">${title}</div>
      <div class="figure-box">
        ${
          rows.length
            ? `
          <table class="data-table">
            ${rows
              .map(
                (row) => `
              <tr>
                <td>${row.label || row.platform || ""}</td>
                <td>${row.value || row.rating || ""}</td>
              </tr>
            `
              )
              .join("")}
          </table>
        `
            : `<p class="vf-value" style="text-align:center;">Aucune donnée renseignée</p>`
        }
      </div>
    </div>
  `;
}

function docsGrid(documents = []) {
  if (!documents.length) return "";

  return `
    <div class="docs-section">
      <h3>Les documents suivants sont disponibles à votre demande</h3>
      <div class="docs-grid">
        ${documents
          .map(
            (doc) => `
          <div class="docs-item">
            ${icon("FileText", 14)}
            <span class="docs-item-label">${doc.categoryLabel || doc.originalname || ""}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

module.exports = {
  figureBox,
  docsGrid,
};
