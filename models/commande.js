const mongoose = require('mongoose');

const commandeSchema = new mongoose.Schema({
  
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',        // ✅ Fixed: was 'Client' — must match your User model
    required: true
  },
  chauffeur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chauffeur'    // ✅ Added: was missing, needed for .populate('chauffeur')
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
    enum: ['en attente', 'acceptée', 'en livraison', 'livrée', 'annulée'], // ✅ Added 'annulée'
    default: 'en attente'
  },

  date: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('Commande', commandeSchema);