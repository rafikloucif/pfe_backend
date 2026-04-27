const mongoose = require('mongoose');
const ReclamationSchema = new mongoose.Schema({
  client:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  commande: { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', default: null },
  sujet:    { type: String, required: true },
  message:  { type: String, default: '' },
  status:   { type: String, enum: ['ouverte','en traitement','résolue','fermée'], default: 'ouverte' },
  priorite: { type: String, enum: ['haute','normale','basse'], default: 'normale' },
}, { timestamps: true });
module.exports = mongoose.model('Reclamation', ReclamationSchema);