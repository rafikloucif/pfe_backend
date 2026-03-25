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

// UPDATE FOURNISSEUR POSITION
router.put("/position", auth, role("fournisseur"), async (req, res) => {
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

// SET OFFLINE
router.put("/offline", auth, role("fournisseur"), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false });
    res.json({ msg: "Hors ligne" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
