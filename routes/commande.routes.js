const express = require('express');
const Commande = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const auth = require('../middleware/auth');
const role = require('../middleware/role');

const router = express.Router();

// CLIENT ADD COMMANDE
router.post('/add', auth, role("client"), async (req, res) => {

  const { capacite, prix } = req.body;

  if (!capacite || !prix) {
    return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
  }

  if (capacite <= 0 || prix <= 0) {
    return res.status(400).json({ msg: "Valeurs invalides" });
  }

  const commande = new Commande({
    client: req.user.id,
    capacite,
    prix
  });

  await commande.save();
  res.json(commande);
});

// FOURNISSEUR VOIR COMMANDES EN ATTENTE
router.get('/pending', auth, role("fournisseur"), async (req, res) => {

  const commandes = await Commande.find({ status: "en attente" });
  res.json(commandes);
});

// ASSIGN COMMANDE
router.put('/assign/:commandeId/:chauffeurId', auth, role("fournisseur"), async (req, res) => {

  const commande = await Commande.findById(req.params.commandeId);
  const chauffeur = await Chauffeur.findById(req.params.chauffeurId);

  if (!commande || !chauffeur) {
    return res.status(404).json({ msg: "Not found" });
  }

  // ✅ Fixed: compare with req.user.id (not req.user)
  if (chauffeur.fournisseur.toString() !== req.user.id) {
    return res.status(403).json({ msg: "Ce chauffeur ne vous appartient pas" });
  }

  if (!chauffeur.disponible) {
    return res.status(400).json({ msg: "Chauffeur non disponible" });
  }

  commande.chauffeur = chauffeur._id;
  commande.status = "en livraison";

  chauffeur.disponible = false;

  await commande.save();
  await chauffeur.save();

  res.json({ msg: "Commande assignée avec succès" });
});

// FINISH DELIVERY
router.put('/livree/:id', auth, role("fournisseur"), async (req, res) => {

  const commande = await Commande.findById(req.params.id);

  if (!commande) {
    return res.status(404).json({ msg: "Commande introuvable" });
  }

  commande.status = "livrée";

  const chauffeur = await Chauffeur.findById(commande.chauffeur);
  if (chauffeur) {
    chauffeur.disponible = true;
    await chauffeur.save();
  }

  await commande.save();

  res.json({ msg: "Livraison terminée" });
});

// CANCEL COMMANDE
router.put('/cancel/:id', auth, role("client"), async (req, res) => {

  const commande = await Commande.findById(req.params.id);

  if (!commande) {
    return res.status(404).json({ msg: "Commande introuvable" });
  }

  // ✅ Fixed: compare with req.user.id (not req.user)
  if (commande.client.toString() !== req.user.id) {
    return res.status(403).json({ msg: "Accès refusé" });
  }

  if (commande.status === "livrée" || commande.status === "annulée") {
    return res.status(400).json({ msg: "Impossible d'annuler cette commande" });
  }

  if (commande.status === "en livraison" && commande.chauffeur) {
    const chauffeur = await Chauffeur.findById(commande.chauffeur);
    if (chauffeur) {
      chauffeur.disponible = true;
      await chauffeur.save();
    }
  }

  commande.status = "annulée";
  await commande.save();

  res.json({ msg: "Commande annulée avec succès" });
});

// GET ALL COMMANDES (fournisseur, with optional status filter)
router.get('/', auth, role("fournisseur"), async (req, res) => {

  const { status } = req.query;

  let filter = {};
  if (status) {
    filter.status = status;
  }

  const commandes = await Commande.find(filter)
    .populate('client', '-password')
    .populate('chauffeur');

  res.json(commandes);
});

// GET MY COMMANDES (client)
router.get('/my', auth, role("client"), async (req, res) => {

  const commandes = await Commande.find({ client: req.user.id });
  res.json(commandes);
});

module.exports = router;