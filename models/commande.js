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
  telephone: String,
  status: {
    type: String,
    enum: ['en attente', 'acceptée', 'en livraison', 'livrée', 'annulée'],
    default: 'en attente'
  },
  // ✅ Client GPS position — stored as nested object for tracking
  position: {
    lat: { type: Number, default: null },
    lon: { type: Number, default: null },
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Commande', commandeSchema);