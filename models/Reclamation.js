const mongoose = require('mongoose');
 const ReclamationSchema = new mongoose.Schema({
   client:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
   commande:  { type: mongoose.Schema.Types.ObjectId, ref: 'Commande' },
   sujet:     { type: String, required: true },
   message:   { type: String },
   status:    { type: String, enum: ['ouverte','en traitement','résolue','fermée'], default: 'ouverte' },
   priorite:  { type: String, enum: ['haute','normale','basse'], default: 'normale' },
 }, { timestamps: true });
 module.exports = mongoose.model('Reclamation', ReclamationSchema);
