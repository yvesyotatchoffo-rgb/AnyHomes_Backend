const PersonaController = require("../controllers/PersonaController");
var router = require("express").Router();

router.post("/create", PersonaController.create);
router.get("/list", PersonaController.list);
router.get("/:id", PersonaController.detail);
router.put("/:id", PersonaController.update);
router.delete("/:id", PersonaController.delete);

module.exports = router;
