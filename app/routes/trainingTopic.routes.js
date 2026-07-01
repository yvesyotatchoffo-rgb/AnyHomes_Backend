const express = require("express");
const router = express.Router();
const TrainingTopicController = require("../controllers/TrainingTopicController");

// Create training topic
router.post("/create", TrainingTopicController.create);

// Get all training topics
router.get("/list", TrainingTopicController.list);

// Get single training topic
router.get("/:id", TrainingTopicController.detail);

// Update training topic
router.put("/:id", TrainingTopicController.update);

// Delete training topic
router.delete("/:id", TrainingTopicController.deleteTopic);

module.exports = router;
