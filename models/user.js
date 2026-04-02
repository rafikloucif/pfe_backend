const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase:true
  },
  password: {
    type: String,
    required: true
    
  },

   adresse: {
    type: String,
    required: true
  },
     role: {
    type: String,
    enum:["client","chauffeur","gerant"],
    default:null
  },
  fournisseurInfo: {
  quantiteEau: { type: Number, default: 0 },
  wilayas:     { type: [String], default: [] }
},

gerantInfo: {
  chauffeurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  code: { type: String, default: null } // ← unique code for each gérant
},


  position: {
  lat: { type: Number, default: null },
  lon: { type: Number, default: null }
},
isOnline: { type: Boolean, default: false }
 
});

module.exports = mongoose.models.User  ||  mongoose.model('User', UserSchema);