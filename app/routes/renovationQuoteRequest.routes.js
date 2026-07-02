const ctrl = require("../controllers/RenovationQuoteRequestController");
var router = require("express").Router();

router.post("/add", ctrl.add);
router.get("/listing", ctrl.listing);
router.put("/status", ctrl.updateStatus);

module.exports = router;
