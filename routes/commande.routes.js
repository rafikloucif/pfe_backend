const express = require('express');
const Commande = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const authClient = require('../middleware/authClient');
const authFournisseur = require('../middleware/authFournisseur');

const router = express.Router();

// CLIENT ADD COMMANDE
router.post('/add', authClient, async (req, res) => {

const { capacite, prix } = req.body;

if (!capacite || !prix) {
  return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
}

if (capacite <= 0 || prix <= 0) {
  return res.status(400).json({ msg: "Valeurs invalides" });
}
  const commande = new Commande({
    client: req.user,
    capacite: req.body.capacite,
    prix: req.body.prix
  });

  await commande.save();
  res.json(commande);
});

// FOURNISSEUR VOIR COMMANDES EN ATTENTE
router.get('/pending', authFournisseur, async (req, res) => {

  const commandes = await Commande.find({ status: "en attente" });
  res.json(commandes);
});

// ASSIGN COMMANDE
router.put('/assign/:commandeId/:chauffeurId', authFournisseur, async (req, res) => {

  const commande = await Commande.findById(req.params.commandeId);
  const chauffeur = await Chauffeur.findById(req.params.chauffeurId);

  if (!commande || !chauffeur) {
    return res.status(404).json({ msg: "Not found" });
  }

  // ✅ Vérification ملكية
  if (chauffeur.fournisseur.toString() !== req.user.toString()) {
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
router.put('/livree/:id', authFournisseur, async (req, res) => {

  const commande = await Commande.findById(req.params.id);

  commande.status = "livrée";

  const chauffeur = await Chauffeur.findById(commande.chauffeur);
  chauffeur.disponible = true;

  await commande.save();
  await chauffeur.save();

  res.json({ msg: "Livraison terminée" });
});

router.put('/cancel/:id', authClient, async (req, res) => {

  const commande = await Commande.findById(req.params.id);

  if (!commande) {
    return res.status(404).json({ msg: "Commande introuvable" });
  }

  // نتأكد بلي راهي تاع هذا client
  if (commande.client.toString() !== req.user.toString()) {
    return res.status(403).json({ msg: "Accès refusé" });
  }

  // ما يقدرش يلغي إذا كانت livrée أو annulée
  if (commande.status === "livrée" || commande.status === "annulée") {
    return res.status(400).json({ msg: "Impossible d'annuler cette commande" });
  }

  // إذا كانت en livraison لازم نرجع chauffeur disponible
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


router.get('/', authFournisseur, async (req, res) => {

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



router.get('/my', authClient, async (req, res) => {

  const commandes = await Commande.find({ client: req.user });

  res.json(commandes);

});

module.exports = router;