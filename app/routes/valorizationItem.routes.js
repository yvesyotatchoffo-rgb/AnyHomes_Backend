const express = require("express");
const router = express.Router();
const controller = require("../controllers/ValorizationItemController");

router.post("/add", controller.add);
router.get("/listing", controller.listing);
router.get("/details", controller.details);
router.put("/edit", controller.edit);
router.delete("/delete", controller.remove);

module.exports = router;
