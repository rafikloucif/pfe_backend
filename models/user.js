const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom:       { type: String, required: true },
  prenom:    { type: String, required: true },
  telephone: { type: String, required: true },  // ✅ add — used in register
  email:     { type: String, required: true, unique: true },
  adresse:   { type: String, required: true},  // ✅ add — used in register
  password:  { type: String, required: true },
  role: {
    type: String,
    enum: ['client',  'chauffeur', 'gerant'],
    default : null 
  },


verified: { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  verificationCodeExpires: { type: Date, default: null },



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