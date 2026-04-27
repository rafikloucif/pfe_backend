// ============================================================
// routes/admin.route.js
// Mount this in your main app.js / server.js with:
//   const adminRoutes = require('./routes/admin');
//   app.use('/api/admin', verifyAdmin, adminRoutes);
// ============================================================

const express = require('express');
const router  = express.Router();

// -- adjust these paths to match your project structure --
const User        = require('../models/user');        // your user model
const Commande    = require('../models/commande');
const Reclamation = require('../models/Reclamation'); // create if missing
const Avis        = require('../models/Avis');        // create if missing
const Log         = require('../models/Log');         // create if missing
const Warning     = require('../models/Warning');     // create if missing

// ============================================================
// MIDDLEWARE  —  paste this in a separate file or inline here
// ============================================================
// middlewares/verifyAdmin.js
//
// const jwt = require('jsonwebtoken');
// module.exports = (req, res, next) => {
//   const auth = req.headers.authorization;
//   if (!auth) return res.status(401).json({ msg: 'No token' });
//   try {
//     const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
//     // Option A: you store role in the token
//     if (decoded.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
//     // Option B: you check a hardcoded admin email/id
//     // if (decoded.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ msg: 'Forbidden' });
//     req.user = decoded;
//     next();
//   } catch (e) {
//     return res.status(401).json({ msg: 'Invalid token' });
//   }
// };

// ============================================================
// ── USERS ────────────────────────────────────────────────────
// ============================================================

// GET /api/admin/users
// Returns all users (clients + fournisseurs, NOT admins)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('-password')          // never send passwords
      .lean();

    // Attach order count to each user
    const withCounts = await Promise.all(users.map(async (u) => {
      const orders = await Commande.countDocuments({ client: u._id });
      return { ...u, commandesCount: orders };
    }));

    res.json(withCounts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/users/:id/suspend
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'suspendu' },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/users/:id/unsuspend
router.put('/users/:id/unsuspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'actif' },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    // Optional: also cancel their pending commandes
    await Commande.updateMany(
      { client: req.params.id, status: { $in: ['en attente', 'en cours'] } },
      { status: 'annulée' }
    );
    res.json({ msg: 'User deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── CHAUFFEURS ───────────────────────────────────────────────
// ============================================================

// GET /api/admin/chauffeurs
// If your chauffeurs are stored in the User model with role='chauffeur':
router.get('/chauffeurs', async (req, res) => {
  try {
    // Option A — separate Chauffeur collection
    // const chauffeurs = await Chauffeur.find().lean();

    // Option B — users with role chauffeur (adjust to your schema)
    const chauffeurs = await User.find({ role: 'chauffeur' })
      .select('-password')
      .lean();

    // Attach delivery stats
    const withStats = await Promise.all(chauffeurs.map(async (c) => {
      const total   = await Commande.countDocuments({ chauffeur: c._id, status: 'livrée' });
      const now     = new Date();
      const monthly = await Commande.countDocuments({
        chauffeur: c._id,
        status: 'livrée',
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
          $lt:  new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      });

      // Average rating from Avis
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

// PUT /api/admin/chauffeurs/:id/status
router.put('/chauffeurs/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // 'actif' | 'suspendu' | 'inactif'
    const chauffeur = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    if (!chauffeur) return res.status(404).json({ msg: 'Chauffeur not found' });
    res.json(chauffeur);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── RÉCLAMATIONS ─────────────────────────────────────────────
// ============================================================

// GET /api/admin/reclamations
router.get('/reclamations', async (req, res) => {
  try {
    const claims = await Reclamation.find()
      .populate('client', 'nom prenom email')   // attach client name
      .sort({ createdAt: -1 })
      .lean();
    res.json(claims);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/reclamations/:id
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
// ── AVIS (reviews) ───────────────────────────────────────────
// ============================================================

// GET /api/admin/avis
router.get('/avis', async (req, res) => {
  try {
    const avis = await Avis.find()
      .populate('client',   'nom prenom')
      .populate('chauffeur','nom prenom')
      .sort({ createdAt: -1 })
      .lean();
    res.json(avis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/avis/:id  — hide/show a review
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
// ── LOGS (activity journal) ──────────────────────────────────
// ============================================================

// GET /api/admin/logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find()
      .sort({ createdAt: -1 })
      .limit(200)          // cap to last 200 entries
      .lean();
    res.json(logs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// ── WARNINGS (avertissements) ────────────────────────────────
// ============================================================

// GET /api/admin/warnings
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

// PUT /api/admin/warnings/:id/treat
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



// GET /api/admin/commandes — all commandes, no user filter
router.get('/commandes', async (req, res) => {
  try {
    const commandes = await Commande.find()
      .populate('client',    'nom prenom email')
      .populate('chauffeur', 'nom prenom')
      .populate('fournisseur', 'nom prenom')
      .sort({ createdAt: -1 })
      .lean();
    res.json(commandes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/commandes/:id/cancel
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

// PUT /api/admin/commandes/:commandeId/assign/:chauffeurId
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


// ============================================================
// ── MODELS TO CREATE (if they don't exist yet) ───────────────
// ============================================================
//
// models/Reclamation.js
// ─────────────────────
// const mongoose = require('mongoose');
// const ReclamationSchema = new mongoose.Schema({
//   client:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   commande:  { type: mongoose.Schema.Types.ObjectId, ref: 'Commande' },
//   sujet:     { type: String, required: true },
//   message:   { type: String },
//   status:    { type: String, enum: ['ouverte','en traitement','résolue','fermée'], default: 'ouverte' },
//   priorite:  { type: String, enum: ['haute','normale','basse'], default: 'normale' },
// }, { timestamps: true });
// module.exports = mongoose.model('Reclamation', ReclamationSchema);
//
// ─────────────────────
// models/Avis.js
// ─────────────────────
// const mongoose = require('mongoose');
// const AvisSchema = new mongoose.Schema({
//   client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   chauffeur:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   commande:   { type: mongoose.Schema.Types.ObjectId, ref: 'Commande' },
//   note:       { type: Number, min: 1, max: 5, required: true },
//   commentaire:{ type: String },
//   hidden:     { type: Boolean, default: false },
// }, { timestamps: true });
// module.exports = mongoose.model('Avis', AvisSchema);
//
// ─────────────────────
// models/Log.js
// ─────────────────────
// const mongoose = require('mongoose');
// const LogSchema = new mongoose.Schema({
//   action:  { type: String, required: true },
//   detail:  { type: String },
//   author:  { type: String, default: 'Système' },
//   type:    { type: String, enum: ['commande','reclamation','compte','connexion','signalement','autre'] },
// }, { timestamps: true });
// module.exports = mongoose.model('Log', LogSchema);
//
// ─────────────────────
// models/Warning.js
// ─────────────────────
// const mongoose = require('mongoose');
// const WarningSchema = new mongoose.Schema({
//   title:   { type: String, required: true },
//   user:    { type: String },           // free text e.g. "Chauffeur : Rachid"
//   level:   { type: String, enum: ['urgent','moyen','faible','info'], default: 'info' },
//   treated: { type: Boolean, default: false },
// }, { timestamps: true });
// module.exports = mongoose.model('Warning', WarningSchema);
//
// ─────────────────────
// HOW TO AUTO-LOG ACTIONS  (add this helper anywhere)
// ─────────────────────
// const Log = require('./models/Log');
// async function createLog(action, detail, type, author = 'Admin') {
//   await Log.create({ action, detail, type, author });
// }
// Then call it inside your existing routes, e.g.:
//   await createLog('Commande créée', `#${commande._id} par ${client.nom}`, 'commande', 'Système');
//   await createLog('Compte suspendu', `${user.nom}`, 'compte', 'Admin');
//
// ─────────────────────
// HOW TO MOUNT IN server.js / app.js
// ─────────────────────
// const verifyAdmin = require('./middlewares/verifyAdmin');
// const adminRoutes = require('./routes/admin');
// app.use('/api/admin', verifyAdmin, adminRoutes);
//
// ─────────────────────
// ADMIN USER SETUP (run once in MongoDB or via a seed script)
// ─────────────────────
// db.users.insertOne({
//   nom: 'Admin',
//   prenom: 'Waveau',
//   email: 'admin@waveau.dz',
//   password: '<bcrypt_hashed_password>',
//   role: 'admin',
//   status: 'actif'
// })