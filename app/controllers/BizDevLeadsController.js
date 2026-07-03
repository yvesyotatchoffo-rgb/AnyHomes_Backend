const db = require("../models");
const Property = db.property;

const PROPERTY_TYPE_LABELS = {
  sale: "Vente",
  rent: "Location",
  directory: "Annuaire",
};

/**
 * Build a common property query and projection for BizDev leads.
 */
const buildQuery = async (req, extraFilter = {}) => {
  const { page = 1, count = 20, search = "" } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(count);
  const limit = parseInt(count);

  const match = {
    isDeleted: false,
    status: "active",
    importBy: "user",   // exclure les biens importés via API (moteurImmo, etc.)
    addedBy: { $exists: true, $ne: null }, // s'assurer qu'un vrai user est derrière
    ...extraFilter,
  };

  if (search) {
    match.$or = [
      { propertyTitle: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { zipcode: { $regex: search, $options: "i" } },
    ];
  }

  return { match, skip, limit, page: parseInt(page), count: limit };
};

const formatProperty = (prop) => {
  const owner = prop.addedBy || {};
  const propertyType = prop.propertyType || "";
  return {
    _id: prop._id,
    createdAt: prop.createdAt,
    ownerName: owner.fullName || [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "-",
    ownerId: owner._id || owner.id || null,
    email: prop.email || owner.email || "-",
    phoneNumber: prop.phoneNumber || "-",
    image: prop.images && prop.images.length > 0 ? prop.images[0]?.file || null : null,
    propertyTitle: prop.propertyTitle || "-",
    propertyRef: prop.propertyRef || "-",
    surface: prop.surface || "-",
    rooms: prop.rooms || "-",
    city: prop.city || "-",
    zipcode: prop.zipcode || "-",
    propertyType: propertyType,
    propertyTypeLabel: PROPERTY_TYPE_LABELS[propertyType] || propertyType || "-",
    price: prop.price != null ? prop.price : null,
    sale_my_property: prop.sale_my_property,
    real_estate_market: prop.real_estate_market,
  };
};

module.exports = {
  /**
   * GET /admin/bizdev-leads/agencies
   * Properties where sale_my_property = false (user consents to agency sharing)
   */
  listAgencyLeads: async (req, res) => {
    try {
      const { match, skip, limit, page, count } = await buildQuery(req, {
        sale_my_property: false,
      });

      const [properties, total] = await Promise.all([
        Property.find(match)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("addedBy", "firstName lastName fullName email image _id")
          .lean(),
        Property.countDocuments(match),
      ]);

      return res.json({
        success: true,
        data: properties.map(formatProperty),
        total,
        page,
        count,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * GET /admin/bizdev-leads/anyhomes
   * Properties where real_estate_market = false (user consents to AnyHomes contact)
   */
  listAnyHomesLeads: async (req, res) => {
    try {
      const { match, skip, limit, page, count } = await buildQuery(req, {
        real_estate_market: false,
      });

      const [properties, total] = await Promise.all([
        Property.find(match)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate("addedBy", "firstName lastName fullName email image _id")
          .lean(),
        Property.countDocuments(match),
      ]);

      return res.json({
        success: true,
        data: properties.map(formatProperty),
        total,
        page,
        count,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
