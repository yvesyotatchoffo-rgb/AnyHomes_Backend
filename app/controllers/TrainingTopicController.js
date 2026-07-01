const TrainingTopic = require("../models/trainingTopic.model");

// Create training topic
const create = async (req, res) => {
  try {
    const { name, persona } = req.body;

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Training topic name is required",
      });
    }

    // Validate persona
    if (!persona) {
      return res.status(400).json({
        success: false,
        message: "Persona is required",
      });
    }

    // Check if name already exists
    const existingTopic = await TrainingTopic.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false,
    });

    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: "Training topic with this name already exists",
      });
    }

    const newTopic = new TrainingTopic({
      name: name.trim(),
      persona: persona,
      addedBy: req.identity?.id || req.identity?._id,
    });

    const savedTopic = await newTopic.save();
    const populatedTopic = await savedTopic.populate("persona");
    const topicData = populatedTopic.toJSON();

    res.status(201).json({
      success: true,
      message: "Training topic created successfully",
      data: topicData,
    });
  } catch (error) {
    console.error("Error creating training topic:", error);
    res.status(500).json({
      success: false,
      message: "Error creating training topic",
      error: error.message,
    });
  }
};

// Get all training topics
const list = async (req, res) => {
  try {
    const topics = await TrainingTopic.find({ isDeleted: false })
      .populate("addedBy", "fullName email")
      .populate("persona", "name")
      .sort({ createdAt: -1 });

    const topicsData = topics.map((topic) => topic.toJSON());

    res.status(200).json({
      success: true,
      data: topicsData,
    });
  } catch (error) {
    console.error("Error fetching training topics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching training topics",
      error: error.message,
    });
  }
};

// Get single training topic
const detail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training topic ID is required",
      });
    }

    const topic = await TrainingTopic.findOne({
      _id: id,
      isDeleted: false,
    }).populate("addedBy", "fullName email").populate("persona", "name");

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: "Training topic not found",
      });
    }

    const topicData = topic.toJSON();

    res.status(200).json({
      success: true,
      data: topicData,
    });
  } catch (error) {
    console.error("Error fetching training topic:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching training topic",
      error: error.message,
    });
  }
};

// Update training topic
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, persona } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training topic ID is required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Training topic name is required",
      });
    }

    if (!persona) {
      return res.status(400).json({
        success: false,
        message: "Persona is required",
      });
    }

    // Check if name already exists (excluding current topic)
    const existingTopic = await TrainingTopic.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      isDeleted: false,
    });

    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: "Training topic with this name already exists",
      });
    }

    const updatedTopic = await TrainingTopic.findByIdAndUpdate(
      id,
      { name: name.trim(), persona: persona },
      { new: true }
    ).populate("addedBy", "fullName email").populate("persona", "name");

    if (!updatedTopic) {
      return res.status(404).json({
        success: false,
        message: "Training topic not found",
      });
    }

    const topicData = updatedTopic.toJSON();

    res.status(200).json({
      success: true,
      message: "Training topic updated successfully",
      data: topicData,
    });
  } catch (error) {
    console.error("Error updating training topic:", error);
    res.status(500).json({
      success: false,
      message: "Error updating training topic",
      error: error.message,
    });
  }
};

// Delete training topic (soft delete)
const deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training topic ID is required",
      });
    }

    const deletedTopic = await TrainingTopic.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deletedTopic) {
      return res.status(404).json({
        success: false,
        message: "Training topic not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Training topic deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting training topic:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting training topic",
      error: error.message,
    });
  }
};

module.exports = {
  create,
  list,
  detail,
  update,
  deleteTopic,
};
