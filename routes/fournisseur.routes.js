const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const User = require('../models/user');
const Chauffeur = require('../models/chauffeur');

// ─────────────────────────────────────────
// CHAUFFEUR INFO
// ─────────────────────────────────────────

router.post('/add-info', auth, role("chauffeur"), async (req, res) => {
  try {
    const { quantiteEau, wilayas } = req.body;
    if (!quantiteEau || !wilayas) {
      return res.status(400).json({ error: "quantiteEau et wilayas sont obligatoires" });
    }
    const foundUser = await User.findById(req.user.id);
    if (!foundUser) return res.status(404).json({ error: "Utilisateur non trouvé" });
    foundUser.fournisseurInfo = { quantiteEau: Number(quantiteEau), wilayas };
    await foundUser.save();
    res.json({ msg: "info added", fournisseurInfo: foundUser.fournisseurInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/position', auth, role("chauffeur"), async (req, res) => {
  try {
    const { lat, lon } = req.body;
    const foundUser = await User.findByIdAndUpdate(
      req.user.id,
      { 'position.lat': lat, 'position.lon': lon, isOnline: true },
      { new: true }
    );
    res.json({ msg: "Position mise à jour", position: foundUser.position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/offline', auth, role("chauffeur"), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false });
    res.json({ msg: "Hors ligne" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, role("chauffeur"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ← fetches User accounts with role "chauffeur" linked to this gerant
router.get('/my', auth, role("gerant"), async (req, res) => {
  try {
    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: "Gérant non trouvé" });

    const chauffeurs = await User.find({
      _id: { $in: gerant.gerantInfo.chauffeurs },
      role: "chauffeur"
    }).select('-password');

    res.json(chauffeurs);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.delete('/:id', auth, role("gerant"), async (req, res) => {
  try {
    const chauffeur = await Chauffeur.findOne({ _id: req.params.id, gerant: req.user.id });
    if (!chauffeur) return res.status(404).json({ msg: "Chauffeur non trouvé" });
    await chauffeur.deleteOne();
    await User.findByIdAndUpdate(req.user.id, { $pull: { 'gerantInfo.chauffeurs': chauffeur._id } });
    res.json({ msg: "Chauffeur supprimé" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────
// JOIN GERANT (CHAUFFEUR enters code)
// ─────────────────────────────────────────

router.post('/join', auth, role("chauffeur"), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ msg: "Code requis" });

    const gerant = await User.findOne({ 'gerantInfo.code': code });
    if (!gerant) return res.status(404).json({ msg: "Code invalide" });

    // Prevent duplicate
    const alreadyJoined = gerant.gerantInfo.chauffeurs
      .map(id => id.toString())
      .includes(req.user.id.toString());
    if (alreadyJoined) return res.status(400).json({ msg: "Vous avez déjà rejoint ce gérant" });

    // Just link the chauffeur User ID to the gerant
    await User.findByIdAndUpdate(gerant._id, {
      $push: { 'gerantInfo.chauffeurs': req.user.id }
    });

    res.json({ msg: "Vous avez rejoint le gérant" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;