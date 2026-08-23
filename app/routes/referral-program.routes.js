const router = require("express").Router();
const controller = require("../controllers/referralProgramController");

router.get("/me", controller.getMe);
router.post("/signup", controller.signup);
router.get("/code/info", controller.getCodeInfo);
router.post("/connect/link", controller.getConnectOnboardingLink);

module.exports = router;
