const express = require("express");
const User = require("../models/user");

const router = express.Router();

// Fournisseurs positions
router.get("/fournisseurs/positions", async (req, res) => {
  try {

    const fournisseurs = await User.find({ role: "fournisseur" })
      .select("nom position");

    res.json(fournisseurs);

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Clients positions
router.get("/clients/positions", async (req, res) => {
  try {

    const clients = await User.find({ role: "client" })
      .select("nom position");

    res.json(clients);

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


module.exports = router;