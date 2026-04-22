const mongoose = require('mongoose');

const camionSchema = new mongoose.Schema({
  gerant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',   // references the gerant's User document
    required: true 
  },
  name: { type: String, required: true },
  plate: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['Actif', 'En maintenance', 'Hors service'], 
    default: 'Actif' 
  },
  model: { type: String },
  year: { type: String },
  lastService: { type: String },
  nextService: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Camion', camionSchema);