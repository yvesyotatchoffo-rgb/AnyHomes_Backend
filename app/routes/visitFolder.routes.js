const express = require("express");
const router = express.Router();
const VisitFolderController = require("../controllers/VisitFolderController");

router.get("/properties", VisitFolderController.getProperties);
router.post("/generate", VisitFolderController.generate);
router.get("/valorization-items", VisitFolderController.getValorizationItems);
router.get("/:id", VisitFolderController.getById);
router.put("/:id", VisitFolderController.update);
router.get("/:id/pdf", VisitFolderController.getPdf);
router.delete("/:id", VisitFolderController.remove);
router.post("/:id/send", VisitFolderController.send);

module.exports = router;
