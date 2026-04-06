const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  prenom: { type: String, default: '' },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['client', 'fournisseur', 'chauffeur', 'gerant'],
    required: true
  },
  position: {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null }
  },
  isOnline: { type: Boolean, default: false },

  // ── ID VRP Python ──────────────────────────────────────────────
  // Utilisé pour synchroniser les chauffeurs avec le backend FastAPI.
  // Généré au moment de l'inscription ou du premier login.
  // Format : 6 derniers caractères de l'ObjectId MongoDB (entier).
  vrpId: { type: Number, default: null },

  // ── Info fournisseur ───────────────────────────────────────────
  fournisseurInfo: {
    quantiteEau: { type: Number, default: 0 },
    wilayas: { type: [String], default: [] }
  },

  // ── Info gérant ────────────────────────────────────────────────
  gerantInfo: {
    code: { type: String, default: null },
    chauffeurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);