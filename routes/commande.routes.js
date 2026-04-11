const express = require('express');
const axios   = require('axios');
const Commande  = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const User      = require('../models/user');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

const VRP_API = process.env.VRP_API_URL || 'http://localhost:8000';

// ─── VRP ID generator ─────────────────────────────────────────────
function genVrpId() {
  return Math.floor(Date.now() / 1000) % 100000 + Math.floor(Math.random() * 100);
}

// ─── Helper: safe axios POST with timeout ─────────────────────────
async function vrpPost(path, body = {}) {
  const resp = await axios.post(`${VRP_API}${path}`, body, { timeout: 15000 });
  return resp.data;
}
async function vrpGet(path) {
  const resp = await axios.get(`${VRP_API}${path}`, { timeout: 15000 });
  return resp.data;
}

// ─────────────────────────────────────────────────────────────────
// SETUP  —  Push driver positions to Python so it can build its
//           distance matrix BEFORE any commande is processed.
//
// Call this once when the fournisseur goes online, or call it
// automatically before the first /assign (see below).
//
// POST /api/commandes/setup
// Body: { chauffeurs: [{id, lat, lon, capacity}], ref_lat, ref_lon }
// ─────────────────────────────────────────────────────────────────
router.post('/setup', auth, role('chauffeur'), async (req, res) => {
  try {
    const { chauffeurs, ref_lat, ref_lon } = req.body;
    if (!chauffeurs || !ref_lat || !ref_lon) {
      return res.status(400).json({ msg: 'chauffeurs, ref_lat, ref_lon requis' });
    }

    const data = await vrpPost('/setup', { chauffeurs, ref_lat, ref_lon });
    console.log('VRP /setup OK:', data);
    res.json({ msg: 'VRP initialisé', vrp: data });
  } catch (err) {
    console.error('POST /setup error:', err.message);
    res.status(502).json({ msg: 'Erreur VRP setup', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// CLIENT ADD COMMANDE
// Also registers the order in Python VRP memory immediately.
// POST /api/commandes/add
// ─────────────────────────────────────────────────────────────────
router.post('/add', auth, role('client'), async (req, res) => {
  try {
    const { capacite, prix, fournisseurId, lat, lon } = req.body;

    if (!capacite || !prix)
      return res.status(400).json({ msg: 'Tous les champs sont obligatoires' });
    if (capacite <= 0 || prix <= 0)
      return res.status(400).json({ msg: 'Valeurs invalides' });
    if (lat == null || lon == null)
      return res.status(400).json({ msg: 'La position (lat, lon) est obligatoire' });

    const vrpId = genVrpId();

    const commande = new Commande({
      client:      req.user.id,
      fournisseur: fournisseurId || null,
      capacite,
      prix,
      position: { lat, lon },
      vrpId,
    });
    await commande.save();

    // Register in Python VRP (non-blocking — failure is logged, not fatal)
    try {
      await vrpPost('/commandes/add', {
        id:          vrpId,
        lat,
        lon,
        demand:      capacite,
        description: `${capacite}L`,
      });
      console.log(`[VRP] Commande ${vrpId} enregistrée`);
    } catch (vrpErr) {
      console.warn(`[VRP] /commandes/add non notifié (${vrpId}):`, vrpErr.message);
    }

    res.json(commande);
  } catch (err) {
    console.error('POST /add error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// FOURNISSEUR — pending commandes
// GET /api/commandes/pending
// ─────────────────────────────────────────────────────────────────
router.get('/pending', auth, role('chauffeur'), async (req, res) => {
  try {
    const commandes = await Commande.find({
      fournisseur: req.user.id,
      status:      'en attente',
    })
      .populate('client', '-password')
      .populate('chauffeur');
    res.json(commandes);
  } catch (err) {
    console.error('GET /pending error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET ALL COMMANDES for fournisseur  (optional ?status= filter)
// GET /api/commandes
// ─────────────────────────────────────────────────────────────────
router.get('/', auth, role('chauffeur'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { fournisseur: req.user.id };
    if (status) filter.status = status;

    const commandes = await Commande.find(filter)
      .populate('client', '-password')
      .populate('chauffeur');

    console.log(`[commandes] found ${commandes.length} for fournisseur ${req.user.id}`);
    res.json(commandes);
  } catch (err) {
    console.error('GET /commandes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// CLIENT — own commandes
// GET /api/commandes/my
// ─────────────────────────────────────────────────────────────────
router.get('/my', auth, role('client'), async (req, res) => {
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

// ─────────────────────────────────────────────────────────────────
// TRACKING — client polls driver position
// GET /api/commandes/:id/track
// ─────────────────────────────────────────────────────────────────
router.get('/:id/track', auth, async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id)
      .populate('client', '-password')
      .populate('chauffeur')
      .populate('fournisseur', 'nom prenom position isOnline');

    if (!commande) return res.status(404).json({ msg: 'Commande introuvable' });

    const fournisseur = commande.fournisseur;
    res.json({
      statut:      commande.status,
      driver_lat:  fournisseur?.position?.lat ?? null,
      driver_lon:  fournisseur?.position?.lon ?? null,
      destination: {
        lat: commande.position?.lat ?? null,
        lon: commande.position?.lon ?? null,
      },
      chauffeur: commande.chauffeur
        ? { nom: commande.chauffeur.nom ?? null, telephone: commande.chauffeur.telephone ?? null }
        : null,
      fournisseur: fournisseur
        ? { nom: fournisseur.nom ?? null, prenom: fournisseur.prenom ?? null }
        : null,
      lastUpdate: fournisseur?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('GET /track error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ASSIGN COMMANDE  ← main route that triggers VRP
//
// Full sequence:
//   1. Validate stock
//   2. Save to MongoDB (status → "en livraison")
//   3. VRP /setup  (send driver positions so Python has a distance matrix)
//   4. VRP /commandes/add  (register commande if not already done)
//   5. VRP /commandes/accept  (mark as accepted in Python state)
//   6. VRP /commandes/:vrpId/ajouter-dynamique  (cheapest-insert + 2-opt)
//   7. VRP /optimisation/optimiser  (run full NSGA-II)
//   8. Return result including VRP routes
//
// PUT /api/commandes/assign/:commandeId/:chauffeurId
// ─────────────────────────────────────────────────────────────────
router.put('/assign/:commandeId/:chauffeurId', auth, role('chauffeur'), async (req, res) => {
  try {
    const commande    = await Commande.findById(req.params.commandeId);
    const fournisseur = await User.findById(req.user.id);

    if (!commande || !fournisseur)
      return res.status(404).json({ msg: 'Not found' });

    // ── Driver resolution ────────────────────────────────────────
    let chauffeur    = null;
    let isSelfDelivery = false;

    if (req.params.chauffeurId === req.user.id) {
      isSelfDelivery = true;
    } else {
      chauffeur = await Chauffeur.findById(req.params.chauffeurId);
      if (!chauffeur)
        return res.status(404).json({ msg: 'Chauffeur introuvable' });
      if (chauffeur.gerant.toString() !== req.user.id)
        return res.status(403).json({ msg: "Ce chauffeur ne vous appartient pas" });
      if (!chauffeur.disponible)
        return res.status(400).json({ msg: 'Chauffeur non disponible' });
    }

    // ── Stock check ──────────────────────────────────────────────
    const quantiteActuelle = fournisseur.fournisseurInfo?.quantiteEau || 0;
    const quantiteCommande = commande.capacite || 0;
    if (quantiteActuelle < quantiteCommande) {
      return res.status(400).json({ msg: "Quantité d'eau insuffisante" });
    }

    // ── Save to MongoDB ──────────────────────────────────────────
    fournisseur.fournisseurInfo.quantiteEau = quantiteActuelle - quantiteCommande;
    commande.chauffeur = isSelfDelivery ? null : chauffeur._id;
    commande.status    = 'en livraison';

    if (!isSelfDelivery && chauffeur) {
      chauffeur.disponible = false;
      await chauffeur.save();
    }
    await fournisseur.save();
    await commande.save();

    // ── VRP pipeline ─────────────────────────────────────────────
    let vrpData = null;

    try {
      // STEP 3 — Setup: send all drivers + fournisseur position to Python
      // so it can build the distance matrix before doing anything else.
      const allChauffeurs = await Chauffeur.find({ gerant: req.user.id });

      // Build driver list: real chauffeurs + fournisseur as fallback driver
      const driverList = allChauffeurs.map(c => ({
        id:       c._id.toString(),
        lat:      c.position?.lat ?? fournisseur.position?.lat ?? 0,
        lon:      c.position?.lon ?? fournisseur.position?.lon ?? 0,
        capacity: c.capacity ?? 1000,
        nom:      c.nom ?? 'Chauffeur',
      }));

      // If self-delivery or no separate drivers, add fournisseur as driver
      if (driverList.length === 0 || isSelfDelivery) {
        driverList.push({
          id:       req.user.id,
          lat:      fournisseur.position?.lat ?? 0,
          lon:      fournisseur.position?.lon ?? 0,
          capacity: fournisseur.fournisseurInfo?.capaciteMax ?? 5000,
          nom:      `${fournisseur.nom ?? ''} ${fournisseur.prenom ?? ''}`.trim(),
        });
      }

      await vrpPost('/setup', {
        chauffeurs: driverList,
        ref_lat:    fournisseur.position?.lat ?? 36.7372,
        ref_lon:    fournisseur.position?.lon ?? 3.0865,
      });
      console.log(`[VRP] /setup OK — ${driverList.length} conducteurs`);

      if (commande.vrpId) {
        // STEP 4 — Register the commande in Python (idempotent — safe to call again)
        try {
          await vrpPost('/commandes/add', {
            id:     commande.vrpId,
            lat:    commande.position?.lat,
            lon:    commande.position?.lon,
            demand: commande.capacite,
          });
          console.log(`[VRP] /commandes/add OK (${commande.vrpId})`);
        } catch (e) {
          // Already registered from /add — not fatal
          console.log(`[VRP] /commandes/add skipped (already exists): ${e.message}`);
        }

        // STEP 5 — Mark as accepted
        await vrpPost('/commandes/accept', {
          commande_id: commande.vrpId,
          action:      'accepter',
        });
        console.log(`[VRP] /commandes/accept OK (${commande.vrpId})`);

        // STEP 6 — Cheapest insert + 2-opt (live, fast)
        const insertResult = await vrpPost(
          `/commandes/${commande.vrpId}/ajouter-dynamique`
        );
        console.log(`[VRP] ajouter-dynamique OK:`, insertResult);

        // STEP 7 — Full NSGA-II optimization over all accepted commandes
        // This is the actual multi-objective genetic algorithm from vrp.py
        const optimResult = await vrpPost('/optimisation/optimiser', {});
        console.log(`[VRP] NSGA-II OK — distance: ${optimResult.distance_totale_km} km`);

        vrpData = optimResult;
      } else {
        console.warn(`[VRP] Commande ${commande._id} sans vrpId — VRP sauté`);
      }
    } catch (vrpErr) {
      // VRP errors are non-fatal: delivery is already saved in MongoDB.
      // Flutter will fall back to haversine nearest-neighbour on the map.
      console.warn('[VRP] pipeline error (non-fatal):', vrpErr.message);
    }

    res.json({
      msg:                 'Commande assignée avec succès',
      nouvelleQuantiteEau: fournisseur.fournisseurInfo.quantiteEau,
      vrp:                 vrpData,
    });
  } catch (err) {
    console.error('PUT /assign error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// FINISH DELIVERY
// PUT /api/commandes/livree/:id
// ─────────────────────────────────────────────────────────────────
router.put('/livree/:id', auth, role('chauffeur'), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) return res.status(404).json({ msg: 'Commande introuvable' });

    commande.status = 'livrée';

    if (commande.chauffeur) {
      const chauffeur = await Chauffeur.findById(commande.chauffeur);
      if (chauffeur) {
        chauffeur.disponible = true;
        await chauffeur.save();
      }
    }

    await commande.save();
    res.json({ msg: 'Livraison terminée' });
  } catch (err) {
    console.error('PUT /livree error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// CANCEL COMMANDE
// PUT /api/commandes/cancel/:id
// ─────────────────────────────────────────────────────────────────
router.put('/cancel/:id', auth, async (req, res) => {
  console.log('>>> cancel hit | role:', req.user.role, '| id:', req.user.id);
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) return res.status(404).json({ msg: 'Commande introuvable' });

    if (req.user.role === 'client') {
      if (commande.client.toString() !== req.user.id)
        return res.status(403).json({ msg: 'Accès refusé' });
    }

    if (commande.status === 'livrée' || commande.status === 'annulée')
      return res.status(400).json({ msg: "Impossible d'annuler cette commande" });

    if (commande.status === 'en livraison' && commande.chauffeur) {
      const chauffeur = await Chauffeur.findById(commande.chauffeur);
      if (chauffeur) {
        chauffeur.disponible = true;
        await chauffeur.save();
      }
    }

    commande.status = 'annulée';
    await commande.save();
    res.json({ msg: 'Commande annulée avec succès' });
  } catch (err) {
    console.error('PUT /cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET VRP SOLUTION  — passthrough to Python, called by Flutter map
// GET /api/commandes/solution
// ─────────────────────────────────────────────────────────────────
router.get('/solution', auth, async (req, res) => {
  try {
    const data = await vrpGet('/optimisation/solution');
    res.json(data);
  } catch (err) {
    console.error('GET /solution error:', err.message);
    res.status(err.response?.status || 502).json({
      msg:   'Erreur VRP solution',
      error: err.response?.data || err.message,
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// MANUAL OPTIMIZE  — trigger NSGA-II at any time
// POST /api/commandes/optimize
// ─────────────────────────────────────────────────────────────────
router.post('/optimize', auth, role('chauffeur'), async (req, res) => {
  try {
    const data = await vrpPost('/optimisation/optimiser', {});
    console.log('[VRP] manual optimize OK:', data);
    res.json(data);
  } catch (err) {
    console.error('POST /optimize error:', err.message);
    res.status(502).json({ msg: 'Erreur VRP optimize', error: err.message });
  }
});

module.exports = router;