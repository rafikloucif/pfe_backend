const express = require('express');
const axios = require('axios');
const Commande = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const User = require('../models/user');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

const VRP_API = process.env.VRP_API_URL || 'http://localhost:8000';

// ─── Compteur d'ID VRP ────────────────────────────────────────────
function genVrpId() {
  return Math.floor(Date.now() / 1000) % 100000 + Math.floor(Math.random() * 100);
}

// ─── CLIENT ADD COMMANDE ──────────────────────────────────────────
router.post('/add', auth, role("client"), async (req, res) => {
  try {
    const { capacite, prix, fournisseurId, lat, lon } = req.body;

    if (!capacite || !prix) {
      return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
    }
    if (capacite <= 0 || prix <= 0) {
      return res.status(400).json({ msg: "Valeurs invalides" });
    }
    if (lat == null || lon == null) {
      return res.status(400).json({ msg: "La position (lat, lon) est obligatoire" });
    }

    const vrpId = genVrpId();

    const commande = new Commande({
      client: req.user.id,
      fournisseur: fournisseurId || null,
      capacite,
      prix,
      position: { lat, lon },
      vrpId
    });

    await commande.save();

    // Enregistrer la commande dans le backend Python (statut en_attente)
    try {
      await axios.post(`${VRP_API}/commandes/add`, {
        id: vrpId,
        lat,
        lon,
        demand: capacite,
        description: `${capacite}L`
      });
      console.log(`Commande ${vrpId} enregistrée dans le VRP`);
    } catch (vrpErr) {
      console.warn(`VRP non notifié pour commande ${vrpId} :`, vrpErr.message);
    }

    res.json(commande);
  } catch (err) {
    console.error('POST /add error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── FOURNISSEUR VOIR COMMANDES EN ATTENTE ────────────────────────
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

// ─── GET ALL COMMANDES (fournisseur only) ─────────────────────────
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

// ─── GET MY COMMANDES (client) ────────────────────────────────────
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

// ─── GET TRACKING — client tracks their commande ──────────────────
router.get('/:id/track', auth, async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id)
      .populate('client', '-password')
      .populate('chauffeur')
      .populate('fournisseur', 'nom prenom position isOnline');

    if (!commande) {
      return res.status(404).json({ msg: "Commande introuvable" });
    }

    const fournisseur = commande.fournisseur;

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

// ─── ASSIGN COMMANDE ──────────────────────────────────────────────
router.put('/assign/:commandeId/:chauffeurId', auth, role("chauffeur"), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.commandeId);
    const chauffeur = await Chauffeur.findById(req.params.chauffeurId);
    const fournisseur = await User.findById(req.user.id);

    if (!commande || !chauffeur || !fournisseur) {
      return res.status(404).json({ msg: "Not found" });
    }

    // ✅ FIXED: field is gerant not fournisseur on the Chauffeur model
    if (chauffeur.gerant.toString() !== req.user.id) {
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

    // ── Notifier le backend Python VRP ────────────────────────────
    let vrpData = null;
    if (commande.vrpId) {
      try {
        await axios.post(`${VRP_API}/commandes/accept`, {
          commande_id: commande.vrpId,
          action: "accepter"
        });
        console.log(`Commande ${commande.vrpId} acceptée côté VRP`);

        // ✅ FIXED: capture the response instead of discarding it
        const vrpResponse = await axios.post(
          `${VRP_API}/commandes/${commande.vrpId}/ajouter-dynamique`
        );
        vrpData = vrpResponse.data;
        console.log(`Commande ${commande.vrpId} insérée dans la solution VRP`);
      } catch (vrpErr) {
        console.warn(`VRP non notifié pour commande ${commande.vrpId} :`, vrpErr.message);
      }
    } else {
      console.warn(`Commande ${commande._id} sans vrpId — VRP non notifié`);
    }

    // ✅ FIXED: vrp routes are now included in the response so Flutter gets them
    res.json({
      msg: "Commande assignée avec succès",
      nouvelleQuantiteEau: fournisseur.fournisseurInfo.quantiteEau,
      vrp: vrpData  // contains distance_totale_km, desequilibre, valide
    });
  } catch (err) {
    console.error('PUT /assign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── FINISH DELIVERY ──────────────────────────────────────────────
router.put('/livree/:id', auth, role("chauffeur"), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ msg: "Commande introuvable" });
    }

    if (!commande.chauffeur || commande.chauffeur.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Accès refusé" });
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

// ─── CANCEL COMMANDE ──────────────────────────────────────────────
router.put('/cancel/:id', auth, async (req, res) => {
  console.log('>>> cancel hit | role:', req.user.role, '| id:', req.user.id);
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) {
      return res.status(404).json({ msg: "Commande introuvable" });
    }

    const userRole = req.user.role;

    if (userRole === 'client') {
      if (commande.client.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Accès refusé" });
      }
    }

    if (commande.status === 'livrée' || commande.status === 'annulée') {
      return res.status(400).json({ msg: "Impossible d'annuler cette commande" });
    }

    if (commande.status === 'en livraison' && commande.chauffeur) {
      const chauffeur = await Chauffeur.findById(commande.chauffeur);
      if (chauffeur) {
        chauffeur.disponible = true;
        await chauffeur.save();
      }
    }

    commande.status = 'annulée';
    await commande.save();

    res.json({ msg: "Commande annulée avec succès" });
  } catch (err) {
    console.error('PUT /cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET VRP SOLUTION (passthrough for Flutter) ───────────────────
// ✅ NEW: Flutter can call GET /api/commandes/solution to fetch the
// current optimised routes at any time (e.g. to refresh the map).
router.get('/solution', auth, async (req, res) => {
  try {
    const response = await axios.get(`${VRP_API}/optimisation/solution`);
    res.json(response.data);
  } catch (err) {
    console.error('GET /solution error:', err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ msg: "Erreur VRP", error: err.response?.data || err.message });
  }
});

module.exports = router;
