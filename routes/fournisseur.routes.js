const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const User = require('../models/user');
const Chauffeur = require('../models/chauffeur');

// ✅ FIXED: was hardcoded to localhost, now uses env var
const VRP_API = process.env.VRP_API_URL || 'http://localhost:8000';

// ─── Génération d'un vrpId unique ────────────────────────────────
function genVrpId() {
  return Math.floor(Date.now() / 1000) % 100000 + Math.floor(Math.random() * 100);
}

// ─────────────────────────────────────────
// FOURNISSEUR INFO
// ─────────────────────────────────────────

router.post('/add-info', auth, role("chauffeur"), async (req, res) => {
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

// ─── UPDATE POSITION ─────────────────────────────────────────────
router.put('/position', auth, role("chauffeur"), async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (lat == null || lon == null) {
      return res.status(400).json({ msg: "lat et lon sont obligatoires" });
    }
    if (typeof lat !== "number" || typeof lon !== "number") {
      return res.status(400).json({ msg: "lat et lon doivent être des nombres" });
    }

    const foundUser = await User.findByIdAndUpdate(
      req.user.id,
      { 'position.lat': lat, 'position.lon': lon, isOnline: true },
      { new: true }
    );

    if (foundUser.vrpId) {
      try {
        await axios.put(`${VRP_API}/conducteurs/${foundUser.vrpId}/position`, { lat, lon });
        console.log(`VRP : position chauffeur ${foundUser.vrpId} mise à jour`);
      } catch (vrpErr) {
        console.warn(`VRP non notifié pour chauffeur ${foundUser.vrpId} :`, vrpErr.message);
      }
    } else {
      console.warn(`Chauffeur ${req.user.id} sans vrpId — VRP non notifié`);
    }

    res.json({ msg: "Position mise à jour", position: foundUser.position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OFFLINE ─────────────────────────────────────────────────────
router.put('/offline', auth, role("chauffeur"), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isOnline: false });
    res.json({ msg: "Hors ligne" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET ME ──────────────────────────────────────────────────────
router.get('/me', auth, role("chauffeur"), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: "Utilisateur non trouvé" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET MY CHAUFFEURS (gérant) ───────────────────────────────────
router.get('/my', auth, role("gerant"), async (req, res) => {
  try {
    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: "Gérant non trouvé" });

    const chauffeurs = await User.find({
      _id: { $in: gerant.gerantInfo.chauffeurs },
      role: "chauffeur"
    }).select('-password');

    res.json(chauffeurs);
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ─── DELETE CHAUFFEUR (gérant) ────────────────────────────────────
router.delete('/:id', auth, role("gerant"), async (req, res) => {
  try {
    const chauffeur = await Chauffeur.findOne({ _id: req.params.id, gerant: req.user.id });
    if (!chauffeur) return res.status(404).json({ msg: "Chauffeur non trouvé" });
    await chauffeur.deleteOne();
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { 'gerantInfo.chauffeurs': chauffeur._id }
    });
    res.json({ msg: "Chauffeur supprimé" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// ─────────────────────────────────────────
// JOIN GERANT (chauffeur entre le code)
// ─────────────────────────────────────────
router.post('/join', auth, role("chauffeur"), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ msg: "Code requis" });

    const gerant = await User.findOne({ 'gerantInfo.code': code });
    if (!gerant) return res.status(404).json({ msg: "Code invalide" });

    const alreadyJoined = gerant.gerantInfo.chauffeurs
      .map(id => id.toString())
      .includes(req.user.id.toString());
    if (alreadyJoined) {
      return res.status(400).json({ msg: "Vous avez déjà rejoint ce gérant" });
    }

    await User.findByIdAndUpdate(gerant._id, {
      $push: { 'gerantInfo.chauffeurs': req.user.id }
    });

    const chauffeurUser = await User.findById(req.user.id);
    if (!chauffeurUser.vrpId) {
      const vrpId = genVrpId();
      chauffeurUser.vrpId = vrpId;
      await chauffeurUser.save();

      try {
        await axios.post(`${VRP_API}/setup/conducteurs`, {
          conducteurs: [{
            id: vrpId,
            lat: chauffeurUser.position?.lat || 36.7538,
            lon: chauffeurUser.position?.lon || 3.0588,
            capacity: chauffeurUser.fournisseurInfo?.quantiteEau || 1000,
            nom: `${chauffeurUser.nom || ''} ${chauffeurUser.prenom || ''}`.trim()
          }]
        });
        console.log(`Chauffeur ${vrpId} enregistré dans le VRP`);
      } catch (vrpErr) {
        console.warn(`VRP non notifié pour chauffeur ${vrpId} :`, vrpErr.message);
      }
    }

    res.json({ msg: "Vous avez rejoint le gérant" });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});


router.put('/quantite-eau', auth, role("chauffeur"), async (req, res) => {
  try {
    const { quantiteEau } = req.body;
    if (quantiteEau == null) {
      return res.status(400).json({ error: "quantiteEau est obligatoire" });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 'fournisseurInfo.quantiteEau': Number(quantiteEau) },
      { new: true }
    ).select('-password');
    res.json({ msg: "Quantité mise à jour", fournisseurInfo: user.fournisseurInfo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;