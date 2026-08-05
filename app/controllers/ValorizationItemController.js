const db = require("../models");

const add = async (req, res) => {
  try {
    const { label, label_en, category, order, isActive } = req.body;
    if (!label) {
      return res.status(400).json({ success: false, error: { code: 400, message: "Le label est requis." } });
    }
    const item = await db.valorizationItem.create({
      label,
      label_en: label_en || "",
      category: category || "",
      order: order || 0,
      isActive: isActive !== false,
    });
    return res.status(200).json({ success: true, data: item, message: "Élément ajouté." });
  } catch (err) {
    console.error("Error in valorizationItem add:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const listing = async (req, res) => {
  try {
    const { page = 1, count = 50, search = "", isActive } = req.query;
    const filter = {};
    if (search) filter.label = { $regex: search, $options: "i" };
    if (isActive !== undefined) filter.isActive = isActive === "true" || isActive === true;

    const total = await db.valorizationItem.countDocuments(filter);
    const data = await db.valorizationItem.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * count)
      .limit(Number(count))
      .lean();

    return res.status(200).json({ success: true, data, total });
  } catch (err) {
    console.error("Error in valorizationItem listing:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const details = async (req, res) => {
  try {
    const item = await db.valorizationItem.findById(req.query.id).lean();
    if (!item) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Élément non trouvé." } });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error("Error in valorizationItem details:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const edit = async (req, res) => {
  try {
    const { id, label, label_en, category, order, isActive } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: { code: 400, message: "ID requis." } });
    }
    const update = {};
    if (label !== undefined) update.label = label;
    if (label_en !== undefined) update.label_en = label_en;
    if (category !== undefined) update.category = category;
    if (order !== undefined) update.order = Number(order);
    if (isActive !== undefined) update.isActive = isActive;

    const item = await db.valorizationItem.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!item) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Élément non trouvé." } });
    }
    return res.status(200).json({ success: true, data: item, message: "Élément mis à jour." });
  } catch (err) {
    console.error("Error in valorizationItem edit:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

const remove = async (req, res) => {
  try {
    const item = await db.valorizationItem.findByIdAndDelete(req.body.id);
    if (!item) {
      return res.status(404).json({ success: false, error: { code: 404, message: "Élément non trouvé." } });
    }
    return res.status(200).json({ success: true, message: "Élément supprimé." });
  } catch (err) {
    console.error("Error in valorizationItem remove:", err);
    return res.status(500).json({ success: false, error: { code: 500, message: "" + err } });
  }
};

module.exports = { add, listing, details, edit, remove };
