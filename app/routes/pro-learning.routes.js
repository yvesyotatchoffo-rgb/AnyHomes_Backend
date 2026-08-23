const router = require("express").Router();
const pro = require("../controllers/proLearningController");

// Espace pro (auth requise)
router.get("/access", pro.access);
router.get("/content", pro.list);
router.post("/video", pro.createVideo);
router.post("/blog", pro.createBlog);
router.put("/content/:contentType/:id", pro.updateContent);
router.post("/content/:contentType/:id/toggle", pro.toggleContent);
router.delete("/content/:contentType/:id", pro.deleteContent);

module.exports = router;
