const userRequest = require("../controllers/UserRequestController");
var router = require("express").Router();

// POST sans auth — formulaire public (pré-rempli si connecté via req.identity optionnel)
router.post("/add", userRequest.add);

// GET + PUT protégés — réservés à l'admin (auth gérée dans l'admin router)
router.get("/listing", userRequest.listing);
router.put("/status", userRequest.updateStatus);

module.exports = router;
