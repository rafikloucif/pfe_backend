const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require('uuid');
const User = require("../models/user");
const validator = require("validator");
const auth = require("../middleware/auth");
const emailjs = require("../config/mailer"); // ✅ EmailJS

// ─────────────────────────────────────────
// REGISTER — sends 6-digit OTP via EmailJS
// ─────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    console.log('REGISTER body:', req.body);
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
    if (userExists) return res.status(400).json({ msg: "Email already used" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Calculate expiry time for display
    const expiryDate = new Date(Date.now() + 10 * 60 * 1000);
    const timeStr = expiryDate.toLocaleString('fr-DZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const user = new User({
      nom,
      prenom,
      telephone,
      email,
      password: hashedPassword,
      adresse,
      verified: false,
      verificationCode: code,
      verificationCodeExpires: Date.now() + 10 * 60 * 1000,
    });

    await user.save();

    // ✅ Send via EmailJS using One-Time Password template
   try {
  await emailjs.send(
    process.env.EMAILJS_SERVICE_ID,
    process.env.EMAILJS_TEMPLATE_ID,
    {
      email:    email,
      passcode: code,
      time:     timeStr,
    }
  );
  console.log(` OTP sent to ${email}`);

} catch (emailErr) {
  console.error('❌ EmailJS error:', emailErr); // ✅ add this
  // ✅ Still return success so user can proceed
  // Email failed but user is created — don't block registration
}

res.json({ msg: "Verification code sent", userId: user._id });


  } catch (err) {
    console.error('REGISTER error:', err.message);
    res.status(500).json({ msg: err.message });
  }
});

// ─────────────────────────────────────────
// VERIFY EMAIL
// ─────────────────────────────────────────
router.post("/verify-email", async (req, res) => {
  try {
    const { userId, code } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.verificationCode !== code) {
      return res.status(400).json({ msg: "Invalid code" });
    }

    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({ msg: "Code expired" });
    }

    user.verified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    await user.save();

    res.json({ msg: "Email verified" });

  } catch (err) {
    console.error('VERIFY email error:', err.message);
    res.status(500).json({ msg: err.message });
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

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!user.verified) {
      return res.status(400).json({ msg: "Verify your email first" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ msg: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, role: user.role, secondaryRole: user.secondaryRole },
      process.env.JWT_SECRET
    );

    res.json({
      message: `Hello ${user.nom}`,
      token,
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error('LOGIN error:', err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─────────────────────────────────────────
// CHOOSE ROLE (once only)
// ─────────────────────────────────────────
router.post("/choose-role", async (req, res) => {
  try {
    const { userId, role, addSecondaryRole } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (addSecondaryRole) {
      if (user.role !== 'gerant') {
        return res.status(400).json({ msg: "Only gerant can have a secondary role" });
      }
      if (user.secondaryRole) {
        return res.status(400).json({ msg: "Secondary role already set" });
      }
      user.secondaryRole = 'chauffeur';
      await user.save();
      const token = jwt.sign(
        { id: user._id, role: user.role, secondaryRole: user.secondaryRole },
        process.env.JWT_SECRET
      );
      return res.json({ msg: "secondary role saved", token });
    }

    if (!["client", "chauffeur", "gerant", "fournisseur"].includes(role)) {
      return res.status(400).json({ msg: "Invalid role" });
    }

    if (user.role) return res.status(400).json({ msg: "Role already chosen" });

    user.role = role;

    if (role === 'gerant') {
      user.gerantInfo = { code: uuidv4().slice(0, 8).toUpperCase() };
    }

    await user.save();

    const token = jwt.sign(
      { id: user._id, role: user.role, secondaryRole: user.secondaryRole },
      process.env.JWT_SECRET
    );

    res.json({ msg: "role saved", role: user.role, token });

  } catch (err) {
    console.error('CHOOSE ROLE error:', err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// ─────────────────────────────────────────
// GET ME
// ─────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error('GET ME error:', err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;