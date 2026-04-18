const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/user");
const Commande = require("../models/commande");

// UPDATE CLIENT POSITION
router.put("/position", auth, role("client"), async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (lat == null || lon == null)
      return res.status(400).json({ msg: "lat et lon sont obligatoires" });
    if (typeof lat !== "number" || typeof lon !== "number")
      return res.status(400).json({ msg: "lat et lon doivent être des nombres" });

    const foundUser = await User.findByIdAndUpdate(
      req.user.id,
      { "position.lat": lat, "position.lon": lon, isOnline: true },
      { new: true }
    );
    res.json({ msg: "Position mise à jour", position: foundUser.position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE COMMANDE — broadcast to chauffeurs in same wilaya
router.post("/commandes", auth, role("client"), async (req, res) => {
  try {
    const { wilaya, volume, prix, lat, lon } = req.body;

    if (!wilaya || !volume)
      return res.status(400).json({ msg: "wilaya et volume sont obligatoires" });

    // Find online chauffeurs that serve this wilaya
    const chauffeurs = await User.find({
      $or: [{ role: "chauffeur" }, { secondaryRole: "chauffeur" }],
      isOnline: true,
      wilayas: wilaya,           // chauffeur's wilayas array must include this wilaya
    }).select("_id");

    if (chauffeurs.length === 0)
      return res.status(404).json({ msg: "Aucun chauffeur disponible dans cette wilaya" });

    // Save commande
    const commande = await Commande.create({
      clientId: req.user.id,
      wilaya,
      volume,
      prix: prix ?? 0,
      position: { lat: lat ?? null, lon: lon ?? null },
      status: "pending",
      notifiedChauffeurs: chauffeurs.map(c => c._id),
    });
// Emit to all matching chauffeurs via Socket.io
    const io = req.app.get("io");
    if (io) {
      chauffeurs.forEach(c => {
        io.to(`user_${c._id}`).emit("new_commande", {
          commandeId: commande._id,
          wilaya,
          volume,
          prix: commande.prix,
          position: commande.position,
          clientId: req.user.id,
        });
      });
    }

    res.status(201).json(commande);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;