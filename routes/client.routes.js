const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/user");

// GET ALL FOURNISSEURS
router.get("/fournisseurs", auth, role("client"), async (req, res) => {
  try {
    const fournisseurs = await User.find({
      $or: [
        { role: "chauffeur" },
        { secondaryRole: "chauffeur" }
      ],
      isOnline: true
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

    if (lat == null || lon == null) {
      return res.status(400).json({ msg: "lat et lon sont obligatoires" });
    }

    if (typeof lat !== "number" || typeof lon !== "number") {
      return res.status(400).json({ msg: "lat et lon doivent être des nombres" });
    }

    const foundUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        "position.lat": lat,
        "position.lon": lon,
        isOnline: true,
      },
      { new: true }
    );

    res.json({ msg: "Position mise à jour", position: foundUser.position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;