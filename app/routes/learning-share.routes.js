const router = require("express").Router();
const pro = require("../controllers/proLearningController");

router.post("/share/:contentType/:id", pro.share);

module.exports = router;
