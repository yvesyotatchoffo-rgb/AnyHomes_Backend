const crypto = require("crypto");

/**
 * Génère un code de parrainage lisible : PREFIX-XXXX
 * Ex : YVES-8F3K2
 */
function generateReferralCode(firstname = "USER") {
  const prefix =
    (firstname || "USER")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 8) || "USER";
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${suffix}`;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function calculateCommissionCents(baseAmountHtCents, commissionRate) {
  return Math.round(baseAmountHtCents * commissionRate);
}

/**
 * Convertit un montant en euros (ou décimal) en centimes entiers.
 */
function toCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

module.exports = {
  generateReferralCode,
  addMonths,
  calculateCommissionCents,
  toCents,
};
