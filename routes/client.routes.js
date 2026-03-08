const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Client = require('../models/client');
const authClient = require('../middleware/authClient');
const validator = require('validator');
const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {

  const { nom, prenom, email, password, telephone, adresse } = req.body;

  if (!validator.isEmail(email)) {
  return res.status(400).json({ msg: "Invalid email" });
}

if (password.length < 6) {
  return res.status(400).json({ msg: "Password must be at least 6 characters" });
}

  const exist = await Client.findOne({ email });
  if (exist) return res.status(400).json({ msg: "Email already exists" });

  const hashed = await bcrypt.hash(password, 10);

  const client = new Client({
    nom,
    prenom,
    email,
    password: hashed,
    telephone,
    adresse
  });

  await client.save();
  res.json({ msg: "Client registered" });
});

// LOGIN
router.post('/login', async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email et password obligatoires" });
  }

  const client = await Client.findOne({ email });
  if (!client) {
    return res.status(400).json({ msg: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, client.password);
  if (!valid) {
    return res.status(400).json({ msg: "Invalid credentials" });
  }

  const token = jwt.sign({ id: client._id }, process.env.JWT_SECRET); 

res.json({
  message: `Hello ${client.nom}`,
  token,
  user: {
    id: client._id,
    nom: client.nom,
    email: client.email
  }
});

});



// PROFILE
router.get('/profile', authClient, async (req, res) => {

  const client = await Client.findById(req.user).select('-password');
  res.json(client);

});

module.exports = router;