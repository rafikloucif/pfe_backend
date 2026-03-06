const express = require('express');
const Chauffeur = require('../models/chauffeur');
const authFournisseur = require('../middleware/authFournisseur');

const router = express.Router();

// ADD CHAUFFEUR
router.post('/add', authFournisseur, async (req, res) => {

const { nom, telephone, capaciteCamion } = req.body;

if (!nom || !telephone || !capaciteCamion) {
  return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
}

if (capaciteCamion <= 0) {
  return res.status(400).json({ msg: "Capacité invalide" });
}

  const chauffeur = new Chauffeur({
    nom: req.body.nom,
    telephone: req.body.telephone,
    capaciteCamion: req.body.capaciteCamion,
    fournisseur: req.user
  });

  await chauffeur.save();
  res.json(chauffeur);
});

// GET MY CHAUFFEURS
router.get('/my', authFournisseur, async (req, res) => {

  const chauffeurs = await Chauffeur.find({ fournisseur: req.user });
  res.json(chauffeurs);

});

module.exports = router;