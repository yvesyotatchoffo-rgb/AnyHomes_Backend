const alerts = require("../controllers/AlertsControllers")
var router = require("express").Router();
router.post("/add", alerts.addAlerts);
router.get("/get", alerts.getAlerts);
router.patch("/:id/mark-viewed", alerts.markAlertAsViewed);
router.delete("/delete", alerts.deleteAlerts);
module.exports = router;