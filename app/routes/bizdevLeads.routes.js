const router = require("express").Router();
const BizDevLeadsController = require("../controllers/BizDevLeadsController");

router.get("/agencies", BizDevLeadsController.listAgencyLeads);
router.get("/anyhomes", BizDevLeadsController.listAnyHomesLeads);

module.exports = router;
