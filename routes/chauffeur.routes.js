const express = require('express');
const Chauffeur = require('../models/chauffeur');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

// ADD CHAUFFEUR
router.post('/add', auth, role("fournisseur"), async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse, capaciteCamion } = req.body;

    // ✅ All required fields from the model
    if (!nom || !prenom || !telephone  || !adresse  || !capaciteCamion) {
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
      fournisseur: req.user.id
    });

    await chauffeur.save();
    res.json(chauffeur);
  } catch (err) {
    console.error('add chauffeur error:', err.message);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// GET MY CHAUFFEURS
router.get('/my', auth, role("fournisseur"), async (req, res) => {
  try {
    const chauffeurs = await Chauffeur.find({ fournisseur: req.user.id });
    res.json(chauffeurs);
  } catch (err) {
    console.error('get chauffeurs error:', err.message);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;