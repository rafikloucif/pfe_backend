const express = require('express');
const Chauffeur = require('../models/chauffeur');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const User = require("../models/user");
const router = express.Router();

// ADD CHAUFFEUR
router.post('/add', auth, role("gerant"), async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse, capaciteCamion } = req.body;
    if (!nom || !prenom || !telephone || !adresse || !capaciteCamion) {
      return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
    }
    if (capaciteCamion <= 0) {
      return res.status(400).json({ msg: "Capacité invalide" });
    }
    const chauffeur = new Chauffeur({
      nom,
      prenom,
      telephone,
      adresse,
      capaciteCamion,
      gerant: req.user.id        // ← renamed from fournisseur to gerant
    });
    await chauffeur.save();
    await User.findByIdAndUpdate(req.user.id, {
      $push: { 'gerantInfo.chauffeurs': chauffeur._id }
});
    res.json(chauffeur);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// GET MY CHAUFFEURS
router.get('/my', auth, role("gerant"), async (req, res) => {
  try {
    const chauffeurs = await Chauffeur.find({ gerant: req.user.id });  // ← renamed
    res.json(chauffeurs);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// DELETE CHAUFFEUR
router.delete('/:id', auth, role("gerant"), async (req, res) => {
  try {
    const chauffeur = await Chauffeur.findOne({ _id: req.params.id, gerant: req.user.id });
    if (!chauffeur) {
      return res.status(404).json({ msg: "Chauffeur non trouvé" });
    }
    await chauffeur.deleteOne();
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { 'gerantInfo.chauffeurs': chauffeur._id }
    });
    res.json({ msg: "Chauffeur supprimé" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
