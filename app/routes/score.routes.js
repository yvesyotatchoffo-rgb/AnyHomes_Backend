const scoreController = require("../controllers/ScoreController");
const router = require("express").Router();

router.post("/financial", scoreController.computeScore);
router.post("/renter", scoreController.computeRenterScore);
router.get("/interest/:id", scoreController.getPublicInterestScoreDetail);
router.get("/admin/users", scoreController.listUserScores);
router.get("/admin/users/:id", scoreController.getUserScoreDetail);
router.get("/admin/users/detail/:id", scoreController.getUserScoreDetail);
router.get("/admin/interests", scoreController.listInterestScores);
router.get("/admin/interests/:id", scoreController.getInterestScoreDetail);
router.get("/admin/interests/detail/:id", scoreController.getInterestScoreDetail);

module.exports = router;
