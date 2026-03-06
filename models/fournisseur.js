const mongoose = require('mongoose');

const fournisseurSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    trim: true
  },
  prenom: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  telephone: {
    type: String,
    required: true
  },
  matriculeCamion: {
    type: String,
    required: true,
    unique: true
  }
},

{
  timestamps: true
});

module.exports = mongoose.model('Fournisseur', fournisseurSchema); 