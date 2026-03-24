const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const User = require("../models/user"); // ✅ Capital U to avoid conflict

// ADD FOURNISSEUR INFO
router.post("/add-info", auth, role("fournisseur"), async (req, res) => {
  try {
    const { quantiteEau, wilayas } = req.body;

    const foundUser = await User.findById(req.user.id); // ✅ renamed to avoid conflict

    if (!foundUser) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    foundUser.fournisseurInfo = { quantiteEau, wilayas };
    await foundUser.save();

    res.json({ msg: "info added" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
