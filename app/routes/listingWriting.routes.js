const controller = require("../controllers/ListingWritingController");
const router = require("express").Router();

router.post("/writing/check-missing", (req, res) => {
  controller.checkMissing(req, res);
});

router.post("/writing/generate", (req, res) => {
  controller.generate(req, res);
});

router.get("/writing/versions/:propertyId", (req, res) => {
  controller.versions(req, res);
});

module.exports = router;
