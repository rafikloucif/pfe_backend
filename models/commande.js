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
  // Stocke l'identifiant utilisé par le backend FastAPI/NSGA-II.
  // Permet de faire le lien entre MongoDB et le système VRP
  // sans modifier la logique Python.
  vrpId: {
    type: Number,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('Commande', commandeSchema);