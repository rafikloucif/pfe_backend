const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/user");

// GET ALL FOURNISSEURS
router.get("/fournisseurs", auth, role("client"), async (req, res) => {
  try {
    // ✅ Just filter by role — no fournisseurInfo check
    const fournisseurs = await User.find({
      role: "chauffeur"
    }).select("-password");

    console.log('Fournisseurs found:', fournisseurs.length);
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// UPDATE CLIENT POSITION
router.put("/position", auth, role("client"), async (req, res) => {
  try {
    const { lat, lon } = req.body;

    const foundUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        'position.lat': lat,
        'position.lon': lon,
        isOnline: true
      },
      { new: true }
    );

    res.json({ msg: "Position mise à jour", position: foundUser.position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;