const mongoose = require('mongoose');

const chauffeurSchema = new mongoose.Schema({

  nom: {
    type: String,
    required: true
  },

  telephone: {
    type: String,
    required: true
  },

  capaciteCamion: {
    type: Number,
    required: true
  },

  disponible: {
    type: Boolean,
    default: true
  },

  fournisseur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fournisseur',
    required: true
  }

}, { timestamps: true });

module.exports = mongoose.model('chauffeur', chauffeurSchema);