const plans = require("../controllers/PlansController");
const billingSetting = require("../controllers/BillingSettingController");
var router = require("express").Router();

router.post("/add", plans.createPlans);
router.post("/duplicate", plans.duplicatePlan);
router.get("/detail", plans.planDetail);
router.put("/tva/update", billingSetting.updateSetting);
router.get("/tva", billingSetting.getSetting);
router.put("/update", plans.updateplan);
router.get("/listing", plans.getPlansList);
router.put("/status/change", plans.statusChange);
router.delete("/delete", plans.delete_plan);

module.exports = router;
