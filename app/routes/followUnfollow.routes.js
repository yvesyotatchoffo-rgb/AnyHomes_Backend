var followUnfollow = require("../controllers/followUnfollow");

var router = require("express").Router();

router.get("/listing", followUnfollow.listFollowedProperties);
router.post("/add", followUnfollow.addfollowUnfollow);
router.put("/update", followUnfollow.editFollowUnfollow);


module.exports = router;