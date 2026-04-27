 const mongoose = require('mongoose');
 const LogSchema = new mongoose.Schema({
   action:  { type: String, required: true },
   detail:  { type: String },
   author:  { type: String, default: 'Système' },
   type:    { type: String, enum: ['commande','reclamation','compte','connexion','signalement','autre'] },
 }, { timestamps: true });
 module.exports = mongoose.model('Log', LogSchema);
