const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const User = require("../models/user");

// GET ALL FOURNISSEURS WHO COMPLETED THEIR INFO
router.get("/fournisseurs", auth, role("client"), async (req, res) => {
  try {
    // ✅ Only return fournisseurs who filled their info
    const fournisseurs = await User.find({
      role: "fournisseur",
      fournisseurInfo: { $exists: true, $ne: null }
    }).select("-password"); // ✅ never send passwords

    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;