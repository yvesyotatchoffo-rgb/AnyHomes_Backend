const router = require("express").Router();
const admin = require("../controllers/proLearningAdminController");

router.get("/pending", admin.listPending);
router.get("/content/:contentType/:id", admin.getContent);
router.post("/:contentType/:id/validate", admin.validate);
router.post("/:contentType/:id/reject", admin.reject);

module.exports = router;
