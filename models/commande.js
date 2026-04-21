const mongoose = require('mongoose');

const commandeSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fournisseur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  chauffeur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chauffeur',
    default: null
  },

  // ── NEW: wilaya chosen by client ──────────────────────────────
  wilaya: {
    type: String,
    default: null
  },

  // ── NEW: chauffeurs notified via socket ───────────────────────
  notifiedChauffeurs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],

  capacite: {
    type: Number,
    required: true
  },
  prix: {
    type: Number,
    required: true
  },
  position: {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null }
  },
  status: {
    type: String,
    enum: ['en attente', 'en livraison', 'livrée', 'annulée'],
    default: 'en attente'
  },

  // ── ID Python VRP ──────────────────────────────────────────────
  vrpId: {
    type: Number,
    default: null
  },

  // ── Résultat NSGA-II mis en cache ──────────────────────────────
  vrpResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  expiresAt: {
  type: Date,
  default: null
}

}, { timestamps: true });
 
commandeSchema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports = mongoose.model('Commande', commandeSchema); 
