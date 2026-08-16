// services/visitFolderPdf/adapters/buildPdfViewModel.js
function buildPdfViewModel({ snapshot, destination, selectedPhotos, property, ctx }) {
  const brand = ctx?.brand || {};
  const photos = normalizePhotos(selectedPhotos, property?.images);
  const address = [property?.address, property?.zipcode, property?.city]
    .filter(Boolean)
    .join(", ");

  const ownerName = property?.username || "";
  const ownerShort = compactOwnerName(ownerName);

  return {
    brand: {
      color: brand.color || "#976DD0",
      rgb: brand.rgb || "151, 109, 208",
      logoLight: brand.logoData || "",
      logoDark: brand.logoDataDark || brand.logoData || "",
      url: brand.url || "www.anyhomes.fr",
      name: brand.name || "AnyHomes",
    },

    listing: {
      title: property?.propertyTitle || "",
      address,
      statusLabel: destination === "rent" ? "Location" : "Vente",
      priceValue: snapshot?.price
        ? `${Number(snapshot.price).toLocaleString("fr-FR")} €`
        : "",
      ownerName,
      ownerShort,
      ownerPhone: formatPhoneDisplay(property?.phoneNumber || ""),
      ownerEmail: property?.email || "",
      surface: property?.surface
        ? `${Number(property.surface).toLocaleString("fr-FR")} m²`
        : null,
      rooms: property?.rooms ? `${property.rooms} pièces` : null,
      bedrooms: property?.bedrooms ? `${property.bedrooms} chambres` : null,
      dpe: property?.energyefficient || property?.energy_efficient || null,
      descriptionHtml: compactDescriptionHtml(
        property?.content || "<p>Aucune description renseignée.</p>"
      ),
      qrDataUrl: snapshot?.qrDataUrl || "",
    },

    sections: {
      valorizationItems: snapshot?.valorizationItems || [],
      spaces: (snapshot?.spaces || []).filter(
        (space) => space?.surface && String(space.surface).trim() !== ""
      ),
      prestations: snapshot?.prestations || [],
      photos,
      plans: (snapshot?.plans || []).filter((plan) => plan?.fileName),
      visitHighlights: snapshot?.visitHighlights || "",
      neighborhood: snapshot?.neighborhood || "",
      practicalLife: snapshot?.practicalLife || "",
      condominium: snapshot?.condominium || "",
      tables: snapshot?.tables || [],
      externalRatings: snapshot?.externalRatings || [],
      selectedDocuments: snapshot?.selectedDocuments || [],
    },

    destination,
  };
}

function normalizePhotos(selectedPhotos = [], propertyImages = []) {
  const source =
    Array.isArray(selectedPhotos) && selectedPhotos.length
      ? selectedPhotos
      : Array.isArray(propertyImages)
      ? propertyImages
      : [];

  return source
    .filter(Boolean)
    .slice(0, 10)
    .map((photo, index) => ({
      id: String(photo.fileName || photo.file || index),
      fileName: photo.fileName || photo.file || "",
      originalname: photo.originalname || photo.fileName || photo.file || "",
    }))
    .filter((photo) => photo.fileName);
}

function compactOwnerName(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

function formatPhoneDisplay(raw = "") {
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("33") && digits.length > 10) digits = digits.slice(2);
  const local = digits.slice(-9);
  const groups = [`0${local[0]}`];
  for (let i = 1; i < local.length; i += 2) {
    groups.push(local.slice(i, i + 2));
  }
  return groups.join(" ");
}

function compactDescriptionHtml(html = "") {
  return String(html)
    .replace(/<p>\s*(<strong>.*?<\/strong>)\s*<\/p>\s*<p>/gi, "<p>$1<br /> ")
    .replace(/<\/p>\s*<p>\s*(<strong>.*?<\/strong>)\s*<\/p>\s*<p>/gi, "</p><p>$1<br /> ")
    .replace(/<p>\s*<\/p>/gi, "");
}

module.exports = { buildPdfViewModel };
