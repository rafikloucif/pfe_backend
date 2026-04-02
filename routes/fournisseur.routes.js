const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const User = require('../models/user');
const Chauffeur = require('../models/chauffeur');

// ─────────────────────────────────────────
// FOURNISSEUR (CHAUFFEUR) INFO
// ─────────────────────────────────────────

router.post('/add-info', auth, role("fournisseur"), async (req, res) => {
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

router.put('/position', auth, role("fournisseur"), async (req, res) => {
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

router.put('/offline', auth, role("fournisseur"), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false });
    res.json({ msg: "Hors ligne" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, role("fournisseur"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// CHAUFFEUR MANAGEMENT (GERANT)
// ─────────────────────────────────────────

router.post('/add', auth, role("gerant"), async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse, capaciteCamion } = req.body;
    if (!nom || !prenom || !telephone || !adresse || !capaciteCamion) {
      return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
    }
    if (capaciteCamion <= 0) return res.status(400).json({ msg: "Capacité invalide" });
    const chauffeur = new Chauffeur({ nom, prenom, telephone, adresse, capaciteCamion, gerant: req.user.id });
    await chauffeur.save();
    await User.findByIdAndUpdate(req.user.id, { $push: { 'gerantInfo.chauffeurs': chauffeur._id } });
    res.json(chauffeur);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

router.get('/my', auth, role("gerant"), async (req, res) => {
  try {
    const chauffeurs = await Chauffeur.find({ gerant: req.user.id });
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
// JOIN GERANT (FOURNISSEUR/CHAUFFEUR)
// ─────────────────────────────────────────

router.post('/join', auth, role("fournisseur"), async (req, res) => {
  try {
    const { code, capaciteCamion } = req.body;
    if (!code || !capaciteCamion) return res.status(400).json({ msg: "Code et capacité requis" });

    const gerant = await User.findOne({ 'gerantInfo.code': code });
    if (!gerant) return res.status(404).json({ msg: "Code invalide" });

    // Get full user info since req.user only has id and role
    const chauffeurUser = await User.findById(req.user.id);
    if (!chauffeurUser) return res.status(404).json({ msg: "Utilisateur introuvable" });

    // Prevent duplicate
    const alreadyJoined = await Chauffeur.findOne({ gerant: gerant._id, telephone: chauffeurUser.telephone });
    if (alreadyJoined) return res.status(400).json({ msg: "Vous avez déjà rejoint ce gérant" });

    const chauffeur = new Chauffeur({
      nom:            chauffeurUser.nom,
      prenom:         chauffeurUser.prenom,
      telephone:      chauffeurUser.telephone,
      adresse:        chauffeurUser.adresse,
      capaciteCamion: parseFloat(capaciteCamion),
      gerant:         gerant._id,
    });
    await chauffeur.save();
    await User.findByIdAndUpdate(gerant._id, { $push: { 'gerantInfo.chauffeurs': chauffeur._id } });

    res.json({ msg: "Vous avez rejoint le gérant", chauffeur });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;