const express = require('express');
const Commande = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const User = require('../models/user');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

// CLIENT ADD COMMANDE
router.post('/add', auth, role("client"), async (req, res) => {
  try {
    const { capacite, prix, fournisseurId, lat, lon } = req.body;

    if (!capacite || !prix) {
      return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
    }
    if (capacite <= 0 || prix <= 0) {
      return res.status(400).json({ msg: "Valeurs invalides" });
    }

    const commande = new Commande({
      client: req.user.id,
      fournisseur: fournisseurId || null,
      capacite,
      prix,
      position: {
        lat: lat || null,
        lon: lon || null,
      },
    });

    await commande.save();
    res.json(commande);
  } catch (err) {
    console.error('POST /add error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// FOURNISSEUR VOIR COMMANDES EN ATTENTE
router.get('/pending', auth, role("chauffeur"), async (req, res) => {
  try {
    const commandes = await Commande.find({
      fournisseur: req.user.id,
      status: "en attente"
    })
      .populate('client', '-password')
      .populate('chauffeur');
    res.json(commandes);
  } catch (err) {
    console.error('GET /pending error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET ALL COMMANDES (fournisseur only)
router.get('/', auth, role("chauffeur"), async (req, res) => {
  try {
    const { status } = req.query;
    let filter = { fournisseur: req.user.id };
    if (status) filter.status = status;

    const commandes = await Commande.find(filter)
      .populate('client', '-password')
      .populate('chauffeur');

    console.log('commandes found for fournisseur:', commandes.length);
    res.json(commandes);
  } catch (err) {
    console.error('GET /commandes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET MY COMMANDES (client)
router.get('/my', auth, role("client"), async (req, res) => {
  try {
    const commandes = await Commande.find({ client: req.user.id })
      .populate('fournisseur', 'nom prenom position isOnline')
      .populate('chauffeur');
    res.json(commandes);
  } catch (err) {
    console.error('GET /my error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ GET TRACKING — client tracks their commande
router.get('/:id/track', auth, async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id)
      .populate('client', '-password')
      .populate('chauffeur')
      .populate('fournisseur', 'nom prenom position isOnline');

    if (!commande) {
      return res.status(404).json({ msg: "Commande introuvable" });
    }

    const fournisseur = await User.findById(commande.fournisseur);

    res.json({
      statut: commande.status,
      driver_lat: fournisseur?.position?.lat ?? null,
      driver_lon: fournisseur?.position?.lon ?? null,
      destination: {
        lat: commande.position?.lat ?? null,
        lon: commande.position?.lon ?? null,
      },
      chauffeur: commande.chauffeur ? {
        nom: commande.chauffeur.nom,
        telephone: commande.chauffeur.telephone,
      } : null,
    });
  } catch (err) {
    console.error('GET /track error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ASSIGN COMMANDE
router.put('/assign/:commandeId/:chauffeurId', auth, role("fournisseur"), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.commandeId);
    const chauffeur = await Chauffeur.findById(req.params.chauffeurId);
    const fournisseur = await User.findById(req.user.id);

    if (!commande || !chauffeur || !fournisseur) {
      return res.status(404).json({ msg: "Not found" });
    }

    if (chauffeur.fournisseur.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Ce chauffeur ne vous appartient pas" });
    }

    if (!chauffeur.disponible) {
      return res.status(400).json({ msg: "Chauffeur non disponible" });
    }

    const quantiteActuelle = fournisseur.fournisseurInfo?.quantiteEau || 0;
    const quantiteCommande = commande.capacite || 0;

    if (quantiteActuelle < quantiteCommande) {
      return res.status(400).json({
        msg: "Quantité d'eau insuffisante pour cette commande"
      });
    }

    fournisseur.fournisseurInfo.quantiteEau = quantiteActuelle - quantiteCommande;

    commande.chauffeur = chauffeur._id;
    commande.status = "en livraison";
    chauffeur.disponible = false;

    await fournisseur.save();
    await commande.save();
    await chauffeur.save();

    res.json({
      msg: "Commande assignée avec succès",
      nouvelleQuantiteEau: fournisseur.fournisseurInfo.quantiteEau
    });
  } catch (err) {
    console.error('PUT /assign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// FINISH DELIVERY
router.put('/livree/:id', auth, role("chauffeur"), async (req, res) => {
  try {
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
  } catch (err) {
    console.error('PUT /livree error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// CANCEL COMMANDE
router.put('/cancel/:id', auth, role("client"), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ msg: "Commande introuvable" });
    }
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
  } catch (err) {
    console.error('PUT /cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;