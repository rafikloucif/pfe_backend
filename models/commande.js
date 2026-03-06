const mongoose = require('mongoose');

const commandeSchema = new mongoose.Schema({

  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },

  fournisseur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fournisseur'
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
    enum: ['en attente', 'acceptée', 'en livraison', 'livrée'],
    default: 'en attente'
  },

  date: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('Commande', commandeSchema);