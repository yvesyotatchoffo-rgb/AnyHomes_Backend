const db = require("../models");
const Persona = db.persona;
const constants = require("../utls/constants");

const toKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

module.exports = {
  create: async (req, res) => {
    try {
      const data = req.body;
      if (!data.name) {
        return res.status(400).json({
          success: false,
          message: "Persona name is required",
        });
      }

      const existing = await Persona.findOne({
        name: data.name,
        isDeleted: false,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Persona with this name already exists",
        });
      }

      data.addedBy = req.identity.id;
      if (!data.key) data.key = toKey(data.name);
      const created = await Persona.create(data);

      return res.status(201).json({
        success: true,
        message: "Persona created successfully",
        data: created,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error creating persona",
        error: error.message,
      });
    }
  },

  list: async (req, res) => {
    try {
      const personas = await Persona.find({ isDeleted: false })
        .populate("addedBy", "name email")
        .sort({ rank: 1, createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: personas,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching personas",
        error: error.message,
      });
    }
  },

  detail: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Persona ID is required",
        });
      }

      const persona = await Persona.findOne({ _id: id, isDeleted: false }).populate(
        "addedBy",
        "name email"
      );

      if (!persona) {
        return res.status(404).json({
          success: false,
          message: "Persona not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: persona,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching persona",
        error: error.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Persona ID is required",
        });
      }

      const existing = await Persona.findOne({ _id: id, isDeleted: false });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Persona not found",
        });
      }

      // Check if name is being updated and if it already exists
      if (data.name && data.name !== existing.name) {
        data.key = toKey(data.name);
        const nameExists = await Persona.findOne({
          name: data.name,
          _id: { $ne: id },
          isDeleted: false,
        });

        if (nameExists) {
          return res.status(400).json({
            success: false,
            message: "Persona with this name already exists",
          });
        }
      }

      const updated = await Persona.findByIdAndUpdate(id, data, {
        new: true,
      }).populate("addedBy", "name email");

      return res.status(200).json({
        success: true,
        message: "Persona updated successfully",
        data: updated,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error updating persona",
        error: error.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Persona ID is required",
        });
      }

      const persona = await Persona.findOne({ _id: id, isDeleted: false });
      if (!persona) {
        return res.status(404).json({
          success: false,
          message: "Persona not found",
        });
      }

      await Persona.updateOne({ _id: id }, { isDeleted: true });

      return res.status(200).json({
        success: true,
        message: "Persona deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error deleting persona",
        error: error.message,
      });
    }
  },
};
