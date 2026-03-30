const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const validator = require("validator");
const transporter=require("../config/mailer");


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

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "Email already used" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const user = new User({
      nom,
      prenom,
      telephone,
      email,
      password: hashedPassword,
      adresse,
      verificationCode: code,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000
    });

    await user.save();

     await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification",
      text: `Your verification code is ${code}`
    });

    res.json({ msg: "Verification code sent", userId: user._id });


  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

//verfier email

router.post("/verify-email", async (req, res) => {
  const { userId, code } = req.body;

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ msg: "User not found" });
  }

  if (user.verificationCode !== code) {
    return res.status(400).json({ msg: "Invalid code" });
  }

  if (user.verificationCodeExpires < Date.now()) {
    return res.status(400).json({ msg: "Code expired" });
  }

  user.verified = true;
  user.verificationCode = null;

  await user.save();

  res.json({ msg: "Email verified" });
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

      if (!user.verified) {
    return res.status(400).json({ msg: "Verify your email first" });
  }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ msg: "Wrong password" });
    }

    // ✅ Role included in token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({
      message: `Hello ${user.nom}`,
      token,
      user: {
        id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role
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

    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ msg: "userId and role are required" });
    }

    if (!["client", "fournisseur"].includes(role)) {
      return res.status(400).json({ msg: "Role must be client or fournisseur" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (user.role) {
      return res.status(400).json({ msg: "role already chosen" });
    }

    user.role = role;
    await user.save();

    // ✅ Re-issue token with role now included
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({
      msg: "role saved",
      role: user.role,
      token  // ✅ Flutter must save this new token, replacing the old one
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }

});

module.exports = router;