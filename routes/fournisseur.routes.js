const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/user");

// ADD FOURNISSEUR INFO
router.post("/add-info", auth, role("fournisseur"), async (req, res) => {
  try {
    const { quantiteEau, wilayas } = req.body;

    if (!quantiteEau || !wilayas) {
      return res.status(400).json({ error: "quantiteEau et wilayas sont obligatoires" });
    }

    const foundUser = await User.findById(req.user.id);

    if (!foundUser) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    // ✅ Use $set to properly update nested object
    foundUser.fournisseurInfo = {
      quantiteEau: Number(quantiteEau),
      wilayas: wilayas
    };

    await foundUser.save();

    console.log('Saved fournisseurInfo for:', foundUser._id);
    res.json({ msg: "info added", fournisseurInfo: foundUser.fournisseurInfo });
  } catch (err) {
    console.error('add-info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
