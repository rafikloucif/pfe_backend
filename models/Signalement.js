const mongoose = require('mongoose');
const SignalementSchema = new mongoose.Schema({
  quartier:    { type: String, required: true },
  commune:     { type: String, required: true },
  niveau:      { type: String, enum: ['legere', 'moderee', 'grave'], required: true },
  dureeNombre: { type: Number, required: true },
  dureeUnite:  { type: String, required: true },
  commentaire: { type: String, default: '' },
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('Signalement', SignalementSchema);
