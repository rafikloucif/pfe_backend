const mongoose = require('mongoose');
const AvisSchema = new mongoose.Schema({
  commande:      { type: mongoose.Schema.Types.ObjectId, ref: 'Commande' },
  client:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chauffeur:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note:          { type: Number, min: 1, max: 5, required: true },
  tags:          [{ type: String }],
  commentaire:   { type: String },
  accessFacile:  { type: Boolean },
  clientPresent: { type: Boolean },
  reviewerRole:  { type: String, enum: ['client', 'chauffeur'], required: true },
  hidden:        { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('Avis', AvisSchema);