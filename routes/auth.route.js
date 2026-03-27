const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const validator = require("validator");


// ─────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────
router.post("/register", async (req, res) => {

  try {

    const { nom, prenom, telephone, email, password, adresse } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ msg: "Invalid email" });
    }

    if (!email.endsWith("@gmail.com")) {
      return res.status(400).json({ msg: "Only Gmail allowed" });
    }

    if (password.length < 6) {
      return res.status(400).json({ msg: "Password must be at least 6 characters" });
    }

    const UserExists = await User.findOne({ email });
    if (UserExists) {
      return res.status(400).json({ msg: "Email already used" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const User = new User({
      nom,
      prenom,
      telephone,
      email,
      password: hashedPassword,
      adresse
    });

    await User.save();

    res.json({
      msg: "User created",
      UserId: User._id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }

});


// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email et password obligatoires" });
    }

    const User = await User.findOne({ email });
    if (!User) {
      return res.status(404).json({ msg: "User not found" });
    }

    const match = await bcrypt.compare(password, User.password);
    if (!match) {
      return res.status(401).json({ msg: "Wrong password" });
    }

    // ✅ Role included in token
    const token = jwt.sign(
      { id: User._id, role: User.role },
      process.env.JWT_SECRET
    );

    res.json({
      message: `Hello ${User.nom}`,
      token,
      User: {
        id: User._id,
        nom: User.nom,
        email: User.email,
        role: User.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }

});


// ─────────────────────────────────────────
// CHOOSE ROLE (once only)
// ─────────────────────────────────────────
router.post("/choose-role", async (req, res) => {

  try {

    const { UserId, role } = req.body;

    if (!UserId || !role) {
      return res.status(400).json({ msg: "UserId and role are required" });
    }

    if (!["client", "fournisseur"].includes(role)) {
      return res.status(400).json({ msg: "Role must be client or fournisseur" });
    }

    const User = await User.findById(UserId);
    if (!User) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (User.role) {
      return res.status(400).json({ msg: "role already chosen" });
    }

    User.role = role;
    await User.save();

    // ✅ Re-issue token with role now included
    const token = jwt.sign(
      { id: User._id, role: User.role },
      process.env.JWT_SECRET
    );

    res.json({
      msg: "role saved",
      role: User.role,
      token  // ✅ Flutter must save this new token, replacing the old one
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }

});

module.exports = router;