const db = require("../models");
const { message } = require("../services");
const { success } = require("../services/Response");
const constants = require("../utls/constants");

module.exports = {
  // List all school types
  list: async (req, res) => {
    try {
      const { search = "", page = 1, count = 50 } = req.query;
      const query = { isDeleted: false };
      if (search) query.name = { $regex: search, $options: "i" };

      const skip = (Number(page) - 1) * Number(count);
      const [data, total] = await Promise.all([
        db.schoolTypes.find(query).skip(skip).limit(Number(count)).sort({ createdAt: 1 }),
        db.schoolTypes.countDocuments(query),
      ]);

      return res.json({ success: true, data, total });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Add a school type
  add: async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: "name is required" });

      const existing = await db.schoolTypes.findOne({ name: { $regex: `^${name}$`, $options: "i" }, isDeleted: false });
      if (existing) return res.status(400).json({ success: false, message: "School type already exists" });

      const created = await db.schoolTypes.create({ name });
      return res.json({ success: true, data: created, message: "School type created" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Get detail
  detail: async (req, res) => {
    try {
      const { id } = req.query;
      const data = await db.schoolTypes.findById(id);
      if (!data) return res.status(404).json({ success: false, message: "Not found" });
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Edit a school type
  edit: async (req, res) => {
    try {
      const { id, name } = req.body;
      if (!id || !name) return res.status(400).json({ success: false, message: "id and name are required" });

      const data = await db.schoolTypes.findByIdAndUpdate(id, { name }, { new: true });
      if (!data) return res.status(404).json({ success: false, message: "Not found" });
      return res.json({ success: true, data, message: "School type updated" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Delete (hard)
  delete: async (req, res) => {
    try {
      const { id } = req.query;
      await db.schoolTypes.findByIdAndDelete(id);
      return res.json({ success: true, message: "School type deleted" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // Seed default types
  seed: async (req, res) => {
    try {
      const defaults = [
        "Ecole élémentaire",
        "Maternelle",
        "Primaire",
        "Collège",
        "Lycée",
      ];
      const results = [];
      for (const name of defaults) {
        const existing = await db.schoolTypes.findOne({ name });
        if (!existing) {
          const created = await db.schoolTypes.create({ name });
          results.push(created);
        }
      }
      return res.json({ success: true, message: `${results.length} type(s) seeded`, data: results });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
};
