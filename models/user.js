const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    minlength:2,
    maxlength:25
  },
      prenom: {
    type: String,
    required: true,     
    minlength:2,
    maxlength:25
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
    required: true,
    select: false
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
 
});

module.exports = mongoose.models.user  ||  mongoose.model('user', userSchema);