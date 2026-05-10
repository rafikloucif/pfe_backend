const express = require('express');
const router = express.Router();
const Signalement = require('../models/Signalement');
const auth = require('../middleware/auth');

// POST — client submits a report
router.post('/add', auth, async (req, res) => {
  try {
    const { quartier, commune, niveau, dureeNombre, dureeUnite, commentaire } = req.body;
    const signalement = new Signalement({
      quartier, commune, niveau,
      dureeNombre, dureeUnite, commentaire,
      client: req.userId,
    });
    await signalement.save();
    res.status(201).json(signalement);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET — drivers fetch all reports
router.get('/', auth, async (req, res) => {
  try {
    const { commune, niveau, depuis } = req.query;
    const filter = {};
    if (commune && commune !== 'Toutes') filter.commune = commune;
    if (niveau) filter.niveau = niveau;
    if (depuis) filter.createdAt = { $gte: new Date(Date.now() - Number(depuis)) };
    const signalements = await Signalement.find(filter).sort({ createdAt: -1 });
    res.json(signalements);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;