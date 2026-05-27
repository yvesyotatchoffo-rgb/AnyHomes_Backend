const scoreParametersController = require("../controllers/scoreParametersController");
const router = require("express").Router();

router.get("/detail", scoreParametersController.getDetail);
router.put("/update", scoreParametersController.addUpdate);

module.exports = router;
