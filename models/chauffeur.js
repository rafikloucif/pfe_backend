const mongoose = require('mongoose');

const chauffeurSchema = new mongoose.Schema({

  nom: {
    type: String,
    required: true
  },
   prenom: {
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
   adresse: {
    type: String,
    required: true
  },

 gerant: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true
}

}, { timestamps: true });

module.exports = mongoose.model('Chauffeur', chauffeurSchema);