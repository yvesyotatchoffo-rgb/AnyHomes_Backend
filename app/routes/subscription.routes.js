const subscription = require("../controllers/SubscriptionController.js");
var router = require("express").Router();

router.get("/list", subscription.list);
router.delete("/delete", subscription.delete);
// router.put("/update", subscription.update);


module.exports = router;
