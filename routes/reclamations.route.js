const express     = require('express');
const router      = express.Router();
const Reclamation = require('../models/Reclamation');
const auth        = require('../middleware/auth');
const role        = require('../middleware/role');

// POST /api/reclamations/add — client submits a ticket
router.post('/add', auth, role('client'), async (req, res) => {
  try {
    const { sujet, message, priorite } = req.body;
    if (!sujet) return res.status(400).json({ msg: 'Sujet requis' });

    const reclamation = await Reclamation.create({
      client:   req.user.id,
      sujet,
      message:  message ?? '',
      priorite: priorite ?? 'normale',
      status:   'ouverte',
    });

    res.json(reclamation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/reclamations/my — client sees their own tickets
router.get('/my', auth, role('client'), async (req, res) => {
  try {
    const reclamations = await Reclamation.find({ client: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(reclamations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;