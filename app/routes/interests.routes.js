const interests = require("../controllers/InterestsController.js");
var router = require("express").Router();

router.post("/add", interests.addInterest);
router.post("/admin/rateInterest", interests.rateInterest);

//property list based on interest
router.get("/list", interests.listInterest);
router.get("/detail", interests.userInterests);
router.put("/statusChange", interests.statusChange);
router.put("/propertyTransfer", interests.propertyTransfer)
router.get("/transferHistory", interests.transferHistory);
router.get("/expiredInterests", interests.expiredInterests);

//api to get all the funnelmessages/funnel status of a specific funnel
router.get("/interestMessages", interests.interestMessages);

//api to inform users via email and fcm that in one of their interested property has made some changes 
router.post("/informUsers", interests.informUsers);
router.post("/renterTransfer", interests.renterTransfer);

// requesting owner to transfer the ownership via mail and notification.
router.post("/notifyOwner", interests.notifyOwner)


router.get("/interestPropertyTransactions", interests.propertyBasedInterestTransactions)
module.exports = router;
