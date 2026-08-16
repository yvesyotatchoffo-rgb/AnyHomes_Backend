// services/visitFolderPdf/utils/html.js
function joinHtml(parts = []) {
  return parts.filter(Boolean).join("");
}

function when(condition, html) {
  return condition ? html : "";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = {
  joinHtml,
  when,
  escapeHtml,
};
