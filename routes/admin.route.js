const express = require('express');
const router  = express.Router();

const User        = require('../models/user');
const Commande    = require('../models/commande');
const Reclamation = require('../models/Reclamation');
const Avis        = require('../models/Avis');
const Log         = require('../models/Log');
const Warning     = require('../models/Warning');

// ── Duration map for abonnement plans ────────────────────────
const PLAN_DURATIONS = {
  mensuel:      30,
  trimestriel:  90,
  annuel:       365,
};

// ── Helper: log an admin action ───────────────────────────────
async function createLog(action, detail, type, author = 'Admin') {
  try { await Log.create({ action, detail, type, author }); }
  catch (_) { /* non-fatal */ }
}

// POST /api/admin/login — PUBLIC
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD)
      return res.status(401).json({ msg: 'Identifiants incorrects' });

    const jwt   = require('jsonwebtoken');
    const token = jwt.sign(
      { id: 'admin', role: 'admin', email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (e) {
    console.error('[Admin Login] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── USERS ────────────────────────────────────────────────────
// ============================================================

router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')
      .lean();

    const withCounts = await Promise.all(users.map(async (u) => {
      const orders = await Commande.countDocuments({ client: u._id });
      return { ...u, commandesCount: orders };
    }));

    res.json(withCounts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id/suspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'suspendu' },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    await createLog('Compte suspendu', `${user.nom} ${user.prenom}`, 'compte');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/users/:id/unsuspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'actif' },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    await createLog('Compte réactivé', `${user.nom} ${user.prenom}`, 'compte');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    await Commande.updateMany(
      { client: req.params.id, status: { $in: ['en attente', 'en cours'] } },
      { status: 'annulée' }
    );
    await createLog('Compte supprimé', `ID: ${req.params.id}`, 'compte');
    res.json({ msg: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/signalement', async (req, res) => {
  try {
    const { targetName, targetType, raison, message } = req.body;
    await Warning.create({
      title:   `Signalement : ${raison}`,
      user:    `${targetType} : ${targetName}`,
      level:   'urgent',
      treated: false,
    });
    res.json({ msg: 'Signalement envoyé' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── CHAUFFEURS ───────────────────────────────────────────────
// ============================================================

router.get('/chauffeurs', async (req, res) => {
  try {
    const chauffeurs = await User.find({
      $or: [
        { role: 'chauffeur' },
        { secondaryRole: 'chauffeur' }  // ← add this
      ]
    })
      .select('-password')
      .lean();

    const withStats = await Promise.all(chauffeurs.map(async (c) => {
      const now     = new Date();
      const total   = await Commande.countDocuments({ chauffeur: c._id, status: 'livrée' });
      const monthly = await Commande.countDocuments({
        chauffeur: c._id,
        status: 'livrée',
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt:  new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });
      const avis = await Avis.find({ chauffeur: c._id }).lean();
      const avg  = avis.length
        ? avis.reduce((s, a) => s + a.note, 0) / avis.length
        : 0;
      return {
        ...c,
        totalLivraisons: total,
        livraisonsMois:  monthly,
        noteMoyenne:     parseFloat(avg.toFixed(1)),
      };
    }));

    res.json(withStats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// ============================================================
// ── ABONNEMENTS ──────────────────────────────────────────────
// ============================================================

// GET /api/admin/abonnements
// Lists all fournisseurs with a pending or active abonnement.
// Useful for the admin to see who's waiting for confirmation.
router.get('/abonnements', async (req, res) => {
  try {
    const fournisseurs = await User.find({
      $or: [
        { role: 'chauffeur' },
        { secondaryRole: 'chauffeur' },
      ],
      
    })
      .select('-password')
      .lean();

    const mapped = fournisseurs.map(u => ({
      _id:               u._id,
      nom:               u.nom,
      prenom:            u.prenom,
      email:             u.email,
      telephone:         u.telephone,
      numeroPremit:      u.fournisseurInfo?.numeroPremit      ?? null,
      abonnement:        u.fournisseurInfo?.abonnement        ?? null,
      abonnementStatut:  u.fournisseurInfo?.abonnementStatut  ?? 'en_attente',
      abonnementExpire:  u.fournisseurInfo?.abonnementExpire  ?? null,
      refPaiement:       u.fournisseurInfo?.refPaiement       ?? null,
    }));

    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/abonnements/:userId/confirmer
// Admin confirms that the bank transfer was received.
// Sets statut → 'actif' and computes expiry date from plan duration.
//
// Body: { planOverride?: 'mensuel' | 'trimestriel' | 'annuel' }
//   planOverride is optional — if the admin wants to correct the plan
//   (e.g. the user paid for "annuel" but selected "mensuel" by mistake).
router.put('/abonnements/:userId/confirmer', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'Utilisateur introuvable' });

    const plan = req.body.planOverride || user.fournisseurInfo?.abonnement;
    if (!plan) return res.status(400).json({ msg: 'Aucun plan abonnement trouvé' });

    const days = PLAN_DURATIONS[plan];
    if (!days) return res.status(400).json({ msg: `Plan inconnu: ${plan}` });

    const now    = new Date();
    const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    user.fournisseurInfo              = user.fournisseurInfo || {};
    user.fournisseurInfo.abonnement         = plan;
    user.fournisseurInfo.abonnementStatut   = 'actif';
    user.fournisseurInfo.abonnementExpire   = expiry;
    user.fournisseurInfo.abonnementActiveLe = now;
    user.markModified('fournisseurInfo');
    await user.save();

    await createLog(
      'Abonnement confirmé',
      `${user.nom} ${user.prenom} — plan: ${plan} — expire: ${expiry.toLocaleDateString('fr-DZ')}`,
      'compte'
    );

    res.json({
      msg:    'Abonnement activé avec succès',
      statut: 'actif',
      plan,
      expiry,
    });
  } catch (e) {
    console.error('[Abonnement confirmer]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/abonnements/:userId/refuser
// Admin rejects the payment (wrong ref, amount mismatch, etc.)
// Sets statut → 'refuse' so the app can inform the fournisseur.
router.put('/abonnements/:userId/refuser', async (req, res) => {
  try {
    const { raison } = req.body; // optional reason string

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'Utilisateur introuvable' });

    user.fournisseurInfo              = user.fournisseurInfo || {};
    user.fournisseurInfo.abonnementStatut = 'refuse';
    user.markModified('fournisseurInfo');
    await user.save();

    await createLog(
      'Abonnement refusé',
      `${user.nom} ${user.prenom}${raison ? ` — raison: ${raison}` : ''}`,
      'compte'
    );

    res.json({ msg: 'Abonnement refusé', statut: 'refuse' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/abonnements/:userId/expirer
// Manually expire an abonnement (e.g. chargeback, fraud).
router.put('/abonnements/:userId/expirer', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ msg: 'Utilisateur introuvable' });

    user.fournisseurInfo              = user.fournisseurInfo || {};
    user.fournisseurInfo.abonnementStatut  = 'expire';
    user.fournisseurInfo.abonnementExpire  = new Date();
    user.markModified('fournisseurInfo');
    await user.save();

    await createLog(
      'Abonnement expiré manuellement',
      `${user.nom} ${user.prenom}`,
      'compte'
    );

    res.json({ msg: 'Abonnement expiré', statut: 'expire' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/abonnements/expiring-soon
// Returns fournisseurs whose abonnement expires within the next N days.
// Useful for sending reminders. Default: 7 days.
router.get('/abonnements/expiring-soon', async (req, res) => {
  try {
    const days = parseInt(req.query.days ?? '7', 10);
    const now  = new Date();
    const soon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const users = await User.find({
      'fournisseurInfo.abonnementStatut': 'actif',
      'fournisseurInfo.abonnementExpire': { $gte: now, $lte: soon },
    })
      .select('nom prenom email telephone fournisseurInfo')
      .lean();

    const mapped = users.map(u => ({
      _id:              u._id,
      nom:              u.nom,
      prenom:           u.prenom,
      email:            u.email,
      telephone:        u.telephone,
      abonnement:       u.fournisseurInfo?.abonnement,
      abonnementExpire: u.fournisseurInfo?.abonnementExpire,
      joursRestants:    Math.ceil(
        (new Date(u.fournisseurInfo.abonnementExpire) - now) / (1000 * 60 * 60 * 24)
      ),
    }));

    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── RÉCLAMATIONS ─────────────────────────────────────────────
// ============================================================

router.get('/reclamations', async (req, res) => {
  try {
    const claims = await Reclamation.find()
      .populate('client', 'nom prenom email')
      .sort({ createdAt: -1 })
      .lean();

    const mapped = claims.map(r => ({
      ...r,
      clientNom: `${r.client?.prenom ?? ''} ${r.client?.nom ?? ''}`.trim(),
    }));

    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/reclamations/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Reclamation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!claim) return res.status(404).json({ msg: 'Claim not found' });
    res.json(claim);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── AVIS ─────────────────────────────────────────────────────
// ============================================================

router.get('/avis', async (req, res) => {
  try {
    const avis = await Avis.find()
      .populate('client',    'nom prenom')
      .populate('chauffeur', 'nom prenom')
      .sort({ createdAt: -1 })
      .lean();
    res.json(avis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/avis/:id', async (req, res) => {
  try {
    const { hidden } = req.body;
    const avis = await Avis.findByIdAndUpdate(
      req.params.id,
      { hidden },
      { new: true }
    );
    if (!avis) return res.status(404).json({ msg: 'Review not found' });
    res.json(avis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── LOGS ─────────────────────────────────────────────────────
// ============================================================

router.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── WARNINGS ─────────────────────────────────────────────────
// ============================================================

router.get('/warnings', async (req, res) => {
  try {
    const warnings = await Warning.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(warnings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/warnings/:id/treat', async (req, res) => {
  try {
    const warning = await Warning.findByIdAndUpdate(
      req.params.id,
      { treated: true },
      { new: true }
    );
    if (!warning) return res.status(404).json({ msg: 'Warning not found' });
    res.json(warning);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── COMMANDES ────────────────────────────────────────────────
// ============================================================

router.get('/commandes', async (req, res) => {
  try {
    const commandes = await Commande.find()
      .populate('client',     'nom prenom email')
      .populate('chauffeur',  'nom prenom')
      .populate('fournisseur','nom prenom')
      .sort({ createdAt: -1 })
      .lean();
    res.json(commandes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/commandes/:id/cancel', async (req, res) => {
  try {
    const commande = await Commande.findByIdAndUpdate(
      req.params.id,
      { status: 'annulée', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      { new: true }
    );
    if (!commande) return res.status(404).json({ msg: 'Not found' });
    res.json(commande);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/commandes/:commandeId/assign/:chauffeurId', async (req, res) => {
  try {
    const commande = await Commande.findByIdAndUpdate(
      req.params.commandeId,
      { chauffeur: req.params.chauffeurId },
      { new: true }
    ).populate('chauffeur', 'nom prenom');
    if (!commande) return res.status(404).json({ msg: 'Not found' });
    res.json(commande);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;