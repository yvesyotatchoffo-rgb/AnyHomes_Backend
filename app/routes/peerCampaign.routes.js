const peerCampaign = require("../controllers/peerCampaignController.js");
var router = require("express").Router();


router.post("/start/campagin", peerCampaign.startNewCampign);

router.post("/submit/estimation", peerCampaign.submitPropertyEstimation);

router.get("/hasEstimated", peerCampaign.hasEstimated);

router.get("/userCampaigns", peerCampaign.listUserCampaigns);

router.get("/detail/campaign", peerCampaign.getCampaignDetail);

router.get("/analytics", peerCampaign.overAllAnalytics);

router.post("/purchase/campaign", peerCampaign.purchaseCampaign)

router.get("/download/campaign", peerCampaign.downloadCampaign);

router.get("/list/campaign", peerCampaign.listCampaigns);


module.exports = router;
