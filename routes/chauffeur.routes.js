const express = require('express');
const Chauffeur = require('../models/chauffeur');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

// ADD CHAUFFEUR
router.post('/add', auth, role("fournisseur"), async (req, res) => {

const { nom, telephone, capaciteCamion } = req.body;

if (!nom || !telephone || !capaciteCamion) {
  return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
}

if (capaciteCamion <= 0) {
  return res.status(400).json({ msg: "Capacité invalide" });
}

  const chauffeur = new chauffeur({
    nom: req.body.nom,
    telephone: req.body.telephone,
    capaciteCamion: req.body.capaciteCamion,
    fournisseur: req.user
  });

  await chauffeur.save();
  res.json(chauffeur);
});

// GET MY CHAUFFEURS
router.get('/my', auth, role("fournisseur"), async (req, res) => {

  const chauffeurs = await chauffeur.find({ fournisseur: req.user });
  res.json(chauffeurs);

});

module.exports = router;