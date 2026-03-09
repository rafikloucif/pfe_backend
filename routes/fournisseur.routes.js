const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Fournisseur = require('../models/fournisseur');
const authFournisseur = require('../middleware/authFournisseur');

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {

  const { nom, email, password, telephone } = req.body;

  if (!email.endsWith("@gmail.com")) {
  return res.status(400).json({ msg: "Only Gmail allowed" });
}

if (!nom || !email || !password || !telephone) {
  return res.status(400).json({ msg: "Tous les champs sont obligatoires" });
}

if (password.length < 6) {
  return res.status(400).json({ msg: "Password must be at least 6 characters" });
}

  const exist = await Fournisseur.findOne({ email });
  if (exist) return res.status(400).json({ msg: "Email already exists" });

  const hashed = await bcrypt.hash(password, 10);

  const fournisseur = new Fournisseur({
    nom,
    email,
    password: hashed,
    telephone
  });

  await fournisseur.save();
  res.json({ msg: "Fournisseur registered" });
});

// LOGIN
router.post('/login', async (req, res) => {

  const { email, password } = req.body;

if (!email || !password) {
    return res.status(400).json({ msg: "Email et password obligatoires" });
  }

  const fournisseur = await Fournisseur.findOne({ email });
  if (!fournisseur) return res.status(400).json({ msg: "Invalid credentials" });

  const valid = await bcrypt.compare(password, fournisseur.password);
  if (!valid) return res.status(400).json({ msg: "Invalid credentials" });

  const token = jwt.sign({ id: fournisseur._id }, process.env.JWT_SECRET);

    res.json({
    message: `Hello ${fournisseur.nom}`,
    token,
    user: {
      id: fournisseur._id,
      nom: fournisseur.nom,
      email: fournisseur.email,
      role: "fournisseur"
    }
  });
});

module.exports = router;