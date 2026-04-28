const express = require('express');
const axios   = require('axios');
const Commande  = require('../models/commande');
const Chauffeur = require('../models/chauffeur');
const User      = require('../models/user');
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const router = express.Router();

const VRP_API = process.env.VRP_API_URL || 'https://pfebackendpython.onrender.com';

// ─── VRP ID generator ─────────────────────────────────────────────
function genVrpId() {
  return Math.floor(Date.now() / 1000) % 100000 + Math.floor(Math.random() * 100);
}

// ─── Helper: safe axios calls with timeout ────────────────────────
async function vrpPost(path, body = {}) {
  const resp = await axios.post(`${VRP_API}${path}`, body, { timeout: 15000 });
  return resp.data;
}
async function vrpGet(path) {
  const resp = await axios.get(`${VRP_API}${path}`, { timeout: 15000 });
  return resp.data;
}

// ─────────────────────────────────────────────────────────────────
// SETUP — Push driver positions to Python so it can build its
//         distance matrix BEFORE any commande is processed.
//
// POST /api/commandes/setup
// ─────────────────────────────────────────────────────────────────
router.post('/setup', auth, role('chauffeur'), async (req, res) => {
  try {
    const { chauffeurs } = req.body;
    if (!chauffeurs || !Array.isArray(chauffeurs) || chauffeurs.length === 0) {
      return res.status(400).json({ msg: 'chauffeurs[] requis' });
    }

    // app.py SetupConducteursBody expects: { conducteurs: [...] }
    const data = await vrpPost('/setup/conducteurs', { conducteurs: chauffeurs });
    console.log('[VRP] /setup/conducteurs OK:', data);
    res.json({ msg: 'VRP initialisé', vrp: data });
  } catch (err) {
    console.error('POST /setup error:', err.message);
    res.status(502).json({ msg: 'Erreur VRP setup', error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// CLIENT ADD COMMANDE
// Saves to MongoDB then registers in Python VRP (non-blocking).
//
// POST /api/commandes/add
// ─────────────────────────────────────────────────────────────────
router.post('/add', auth, role('client'), async (req, res) => {
  try {
    const { capacite, prix, lat, lon, wilaya } = req.body;  // ← add wilaya, remove fournisseurId

    if (!capacite || !prix)
      return res.status(400).json({ msg: 'Tous les champs sont obligatoires' });
    if (capacite <= 0 || prix <= 0)
      return res.status(400).json({ msg: 'Valeurs invalides' });
    if (!wilaya)
      return res.status(400).json({ msg: 'La wilaya est obligatoire' });

    const vrpId = genVrpId();

    // Find online chauffeurs in the same wilaya
    const matchingChauffeurs = await User.find({
      $or: [{ role: 'chauffeur' }, { secondaryRole: 'chauffeur' }],
      isOnline: true,
      'fournisseurInfo.wilayas': { $in: [wilaya] }   // ← matches chauffeur's saved wilayas
    }).select('_id');

    const commande = new Commande({
      client:              req.user.id,
      fournisseur:         null,           // ← no longer set by client
      wilaya,
      notifiedChauffeurs:  matchingChauffeurs.map(c => c._id),
      capacite,
      prix,
      position: {
        lat: lat ?? null,
        lon: lon ?? null,
      },
      vrpId,
    });
    await commande.save();

    // Respond immediately
    res.json(commande);

    // Notify matching chauffeurs via socket
    const io = req.app.get('io');
    if (io && matchingChauffeurs.length > 0) {
      matchingChauffeurs.forEach(c => {
        io.to(`user${c._id}`).emit('new_commande', {
          commandeId: commande._id,
          wilaya,
          capacite,
          prix,
          position: commande.position,
          clientId: req.user.id,
        });
      });
      console.log(`[Socket] Notified ${matchingChauffeurs.length} chauffeurs in ${wilaya}`);
} else {
      console.warn(`[Socket] No chauffeurs online in wilaya: ${wilaya}`);
    }

    // Non-blocking VRP registration
    if (lat != null && lon != null) {
      vrpPost('/commandes/add', {
        id:          vrpId,
        lat,
        lon,
        demand:      capacite,
        description: `${capacite}L`,
      })
        .then(() => console.log(`[VRP] Commande ${vrpId} enregistrée`))
        .catch(e  => console.warn(`[VRP] /commandes/add non notifié (${vrpId}):`, e.message));
    }

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
      notifiedChauffeurs: req.user.id,   // ← was: fournisseur: req.user.id
      status: 'en attente',
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
      .populate('chauffeur', 'nom telephone noteMoyenne')        // ← only one populate
      .populate('fournisseur', '-password');                     // ← all fields except password

    console.log('[TRACK] fournisseur:', JSON.stringify(commande?.fournisseur));
    console.log('[TRACK] chauffeur:',   JSON.stringify(commande?.chauffeur));

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
        ? {
            nom:         commande.chauffeur.nom         ?? null,
            telephone:   commande.chauffeur.telephone   ?? null,
            noteMoyenne: commande.chauffeur.noteMoyenne ?? 0,
          }
        : null,
      fournisseur: fournisseur
        ? {
            nom:         fournisseur.nom         ?? null,
            prenom:      fournisseur.prenom       ?? null,
            telephone:   fournisseur.telephone    ?? null,  // ← now included
            noteMoyenne: fournisseur.noteMoyenne  ?? 0,     // ← now included
          }
        : null,
      lastUpdate: fournisseur?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('GET /track error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ASSIGN COMMANDE ← main route that triggers the full VRP pipeline
//
// Sequence:
//   1. Validate stock
//   2. Save to MongoDB  (status → "en livraison")
//   3. Python /setup/conducteurs   — send driver positions
//   4. Python /commandes/add       — register commande
//   5. Python /commandes/accept    — mark accepted; app.py runs NSGA-II here
//   6. Python /commandes/:id/ajouter-dynamique — cheapest-insert + 2-opt
//   7. Python /optimize            — final NSGA-II pass
//   8. Cache optimResult in MongoDB (vrpResult field) ← NEW
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
    let chauffeur      = null;
    let isSelfDelivery = false;

    if (req.params.chauffeurId === req.user.id) {
      isSelfDelivery = true;
    } else {
      chauffeur = await Chauffeur.findById(req.params.chauffeurId);
      if (!chauffeur)
        return res.status(404).json({ msg: 'Chauffeur introuvable' });
      if (chauffeur.gerant.toString() !== req.user.id)
        return res.status(403).json({ msg: "Ce chauffeur ne vous appartient pas" });
      
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

    await fournisseur.save();
    await commande.save();

    // ── VRP pipeline ─────────────────────────────────────────────
    let vrpData = null;

    try {
      // STEP 3 — build driver list, then send to Python
      const allChauffeurs = await Chauffeur.find({ gerant: req.user.id });

      const driverList = allChauffeurs.map(c => ({
        id:       c._id.toString(),
        capacity: c.capacity ?? 1000,        
        lat:      c.position?.lat ?? fournisseur.position?.lat ?? 0,
        lon:      c.position?.lon ?? fournisseur.position?.lon ?? 0,
        nom:      c.nom ?? 'Chauffeur',
      }));

      if (driverList.length === 0 || isSelfDelivery) {
        driverList.push({
          id:       req.user.id,
          lat:      fournisseur.position?.lat ?? 0,
          lon:      fournisseur.position?.lon ?? 0,
          capacity: fournisseur.fournisseurInfo?.capaciteMax ?? 5000,
          nom:      `${fournisseur.nom ?? ''} ${fournisseur.prenom ?? ''}`.trim(),
        });
      }

      // /setup/conducteurs — body key must be "conducteurs"
      const setupResp = await vrpPost('/setup/conducteurs', { conducteurs: driverList });

if (!setupResp || setupResp.error) {
  throw new Error("VRP setup failed");
}

console.log(`[VRP] /setup OK — ${driverList.length} conducteurs`);
      if (commande.vrpId) {
        // STEP 4 — register commande (idempotent)
        try {
          await vrpPost('/commandes/add', {
            id:     commande.vrpId,
            lat:    commande.position?.lat,
            lon:    commande.position?.lon,
            demand: commande.capacite,
            gain:   commande.prix
          });
          console.log(`[VRP] /commandes/add OK (${commande.vrpId})`);
        } catch (e) {
          console.log(`[VRP] /commandes/add skipped (already exists): ${e.message}`);
        }

        // STEP 5 — accept → app.py runs NSGA-II internally here
        await vrpPost('/commandes/accept', {
          commande_id: commande.vrpId,
          action:      'accepter',
        });
        console.log(`[VRP] /commandes/accept OK — NSGA-II ran (${commande.vrpId})`);

        // STEP 6 — cheapest insert + 2-opt on the affected route
        const insertResult = await vrpPost(
          `/commandes/${commande.vrpId}/ajouter-dynamique`
        );
        console.log(`[VRP] ajouter-dynamique OK:`, insertResult);

        // STEP 7 — final full NSGA-II pass over merged solution
        const optimResult = await vrpPost('/optimize', {});
        console.log(`[VRP] NSGA-II final OK — ${optimResult.distance_totale_km} km`);

        vrpData = optimResult;

        // STEP 8 — cache result in MongoDB so Flutter can read it
        // even after Python cold-starts and loses its in-memory state.
        // All active commandes for this fournisseur get the latest solution.
        await Commande.updateMany(
          { fournisseur: req.user.id, status: 'en livraison' },
          { $set: { vrpResult: optimResult } }
        );
        console.log('[VRP] result cached in MongoDB (vrpResult)');

      } else {
        console.warn(`[VRP] Commande ${commande._id} sans vrpId — VRP sauté`);
      }
    } catch (vrpErr) {
      // VRP errors are non-fatal — MongoDB delivery already saved.
      // Flutter falls back to nearest-neighbour on the map.
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
    await commande.save();

    if (commande.chauffeur) {
      // ✅ Only free chauffeur when ALL his commandes are delivered
      const remaining = await Commande.countDocuments({
        chauffeur: commande.chauffeur,
        status:    'en livraison',
      });
      if (remaining === 0) {
        const chauffeur = await Chauffeur.findById(commande.chauffeur);
        if (chauffeur) {
          chauffeur.disponible = true;
          await chauffeur.save();
        }
      }
    }

    res.json({ msg: 'Livraison terminée' });
  } catch (err) {
    console.error('PUT /livree error:', err.message);
    res.status(500).json({ error: err.message });
  }
});



// PUT /api/commandes/accept/:commandeId
router.put('/accept/:commandeId', auth, role('chauffeur'), async (req, res) => {
  try {
    const commande = await Commande.findById(req.params.commandeId);
    if (!commande) return res.status(404).json({ msg: 'Commande introuvable' });

    if (commande.status !== 'en attente')
      return res.status(400).json({ msg: 'Commande déjà traitée' });

    commande.fournisseur = req.user.id;
    commande.status = 'en livraison';
    await commande.save();

    res.json({ msg: 'Commande acceptée', commande });
  } catch (err) {
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

    if (!commande)
      return res.status(404).json({ msg: 'Commande introuvable' });

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

    // ✅ annulée
    commande.status = 'annulée';

    // 🔥 auto delete بعد 10 دقائق
    commande.expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await commande.save();

    res.json({ msg: 'Commande annulée avec succès (sera supprimée automatiquement)' });

  } catch (err) {
    console.error('PUT /cancel error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// GET VRP SOLUTION — serves cached NSGA-II result from MongoDB.
// Falls back to live Python only if no cache exists yet.
//
// FIX: Python on Render free tier loses in-memory state on cold start.
//      The /assign pipeline now saves optimResult to commande.vrpResult
//      so this endpoint can serve it durably without hitting Python.
//
// GET /api/commandes/solution
// ─────────────────────────────────────────────────────────────────
router.get('/solution', auth, async (req, res) => {
  try {
    // 1. Try MongoDB cache first — survives Python cold starts
    const cached = await Commande.findOne(
      {
        fournisseur: req.user.id,
        status:      'en livraison',
        vrpResult:   { $ne: null },
      },
      { vrpResult: 1 },
      { sort: { updatedAt: -1 } }
    );

    if (cached?.vrpResult) {
      console.log('[VRP] /solution served from MongoDB cache');
      return res.json(cached.vrpResult);
    }

    // 2. Fallback: ask Python directly (only works if still warm)
    console.log('[VRP] /solution cache miss — trying Python live');
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
// MANUAL OPTIMIZE — trigger NSGA-II at any time (AppBar button)
// Also refreshes the MongoDB cache with the new result.
// POST /api/commandes/optimize
// ─────────────────────────────────────────────────────────────────
router.post('/optimize', auth, role('chauffeur'), async (req, res) => {
  try {
    const data = await vrpPost('/optimize', {});
    console.log('[VRP] manual optimize OK:', data);

    // Refresh MongoDB cache with the new solution
    await Commande.updateMany(
      { fournisseur: req.user.id, status: 'en livraison' },
      { $set: { vrpResult: data } }
    );
    console.log('[VRP] manual optimize — cache refreshed in MongoDB');

    res.json(data);
  } catch (err) {
    console.error('POST /optimize error:', err.message);
    res.status(502).json({ msg: 'Erreur VRP optimize', error: err.message });
  }
});

module.exports = router;