const ctrl = require("../controllers/PropertyReportController");
var router = require("express").Router();

// Public: anyone can submit a report (authenticated or not)
router.post("/add", ctrl.add);
// Admin only
router.get("/listing", ctrl.listing);
router.put("/status", ctrl.updateStatus);

module.exports = router;
