const express = require('express');
const Chauffeur = require('../models/chauffeur');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

// ADD CHAUFFEUR
router.post('/add', auth, role("fournisseur"), async (req, res) => {

  const { nom, telephone, capaciteCamion } = req.body;

  if ((nom || !prenom || !adresse ||  !telephone || !capaciteCamion)) {
    return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
  }

  if (capaciteCamion <= 0) {
    return res.status(400).json({ msg: "Capacité invalide" });
  }

  // ✅ Fixed: was "new chauffeur" (lowercase) — must be "new Chauffeur"
  const chauffeur = new Chauffeur({
    nom,
    prenom,
    telephone,
    adresse,
    capaciteCamion,
    fournisseur: req.User.id
  });

  await chauffeur.save();
  res.json(chauffeur);
});

// GET MY CHAUFFEURS
router.get('/my', auth, role("fournisseur"), async (req, res) => {

  // ✅ Fixed: was "chauffeur.find" (lowercase) — must be "Chauffeur.find"
  const chauffeurs = await Chauffeur.find({ fournisseur: req.User.id });
  res.json(chauffeurs);
});

module.exports = router;