const blogs = require("../controllers/BlogsController")
var router = require("express").Router();

router.post("/add", blogs.addBlogs);
router.get("/detail", blogs.blogDetails);
router.put("/edit", blogs.editBlogs);
router.put("/statusChange", blogs.statusChange);
router.put("/incrementView", blogs.incrementView);
router.delete("/delete", blogs.deleteBlog);
router.get("/listing",blogs.listing)

module.exports = router;