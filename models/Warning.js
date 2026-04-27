 const mongoose = require('mongoose');
 const WarningSchema = new mongoose.Schema({
   title:   { type: String, required: true },
   user:    { type: String },           // free text e.g. "Chauffeur : Rachid"
   level:   { type: String, enum: ['urgent','moyen','faible','info'], default: 'info' },
   treated: { type: Boolean, default: false },
 }, { timestamps: true });
module.exports = mongoose.model('Warning', WarningSchema);