const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/User");

// GET ALL FOURNISSEURS
router.get("/fournisseurs", auth, role("client"), async (req, res) => {
  try {
    // ✅ Just filter by role — no fournisseurInfo check
    const fournisseurs = await User.find({
      role: "fournisseur"
    }).select("-password");

    console.log('Fournisseurs found:', fournisseurs.length);
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;