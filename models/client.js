const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true
  },
      prenom: {
    type: String,
    required: true,

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
  }
 
});

module.exports = mongoose.exports.client  ||  mongoose.model('client', clientSchema);