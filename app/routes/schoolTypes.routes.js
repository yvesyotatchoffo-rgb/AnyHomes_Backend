const schoolTypes = require("../controllers/SchoolTypesController.js");
var router = require("express").Router();

router.get("/list", schoolTypes.list);
router.post("/add", schoolTypes.add);
router.get("/detail", schoolTypes.detail);
router.put("/edit", schoolTypes.edit);
router.delete("/delete", schoolTypes.delete);
router.post("/seed", schoolTypes.seed);

module.exports = router;
