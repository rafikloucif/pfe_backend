const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom:       { type: String, required: true },
  prenom:    { type: String, required: true },
  telephone: { type: String, required: true },  // ✅ add — used in register
  email:     { type: String, required: true, unique: true },
  password:  { type: String, required: true },
  role: {
    type: String,
    enum: ['client',  'chauffeur', 'gerant'],
    default : null 
  },
  status: {                                    // ← add this
    type: String,
    enum: ['actif', 'suspendu', 'inactif'],
    default: 'actif'
  },


verified: { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  verificationCodeExpires: { type: Date, default: null },

  secondaryRole: {
  type: String,
  enum: ['chauffeur'],
  default: null
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

noteMoyenne: {
  type:    Number,
  default: 0,
  min:     0,
  max:     5,
},

  // ── Info gérant ────────────────────────────────────────────────
  gerantInfo: {
    code: { type: String, default: null },
    chauffeurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    camions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Camion' }],
    numeroPremit:  { type: String, default: null },
    abonnement:    { type: String, enum: ['mensuel','trimestriel','annuel'], default: null },
    refPaiement:   { type: String, default: null },
    abonnementStatut: { type: String, enum: ['en_attente','actif','expire'], default: 'en_attente' },
    abonnementExpire: { type: Date, default: null },
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);