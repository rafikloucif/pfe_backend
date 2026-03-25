const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
    enum:["client","fournisseur"],
    default:null
  },
     fournisseurInfo: {
    quantiteEau: Number,
    wilayas: [String]
  },

  position: {
  lat: { type: Number, default: null },
  lon: { type: Number, default: null }
},
isOnline: { type: Boolean, default: false }
 
});

module.exports = mongoose.models.user  ||  mongoose.model('user', userSchema);