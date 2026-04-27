const express = require('express');
const router  = express.Router();
const Avis    = require('../models/Avis');
const Commande= require('../models/commande');
const auth    = require('../middleware/auth');
const role    = require('../middleware/role');

// POST /api/avis/client  — client rates the chauffeur
router.post('/client', auth, role('client'), async (req, res) => {
  try {
    const { commande, note, tags, commentaire } = req.body;

    const cmd = await Commande.findById(commande)
      .populate('chauffeur');
    if (!cmd) return res.status(404).json({ msg: 'Commande introuvable' });
    if (cmd.client.toString() !== req.user.id)
      return res.status(403).json({ msg: 'Accès refusé' });
    if (cmd.status !== 'livrée')
      return res.status(400).json({ msg: 'Commande non livrée' });

    // Prevent duplicate review
    const existing = await Avis.findOne({ commande, reviewerRole: 'client' });
    if (existing) return res.status(400).json({ msg: 'Avis déjà soumis' });

    const avis = await Avis.create({
      commande,
      client:       req.user.id,
      chauffeur:    cmd.chauffeur?._id ?? null,
      note,
      tags:         tags ?? [],
      commentaire:  commentaire ?? '',
      reviewerRole: 'client',
    });

    res.json(avis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// POST /api/avis/chauffeur  — chauffeur rates the client
router.post('/chauffeur', auth, role('chauffeur'), async (req, res) => {
  try {
    const { commande, note, issues, positives, accessFacile, clientPresent } = req.body;

    const cmd = await Commande.findById(commande);
    if (!cmd) return res.status(404).json({ msg: 'Commande introuvable' });
    if (cmd.status !== 'livrée')
      return res.status(400).json({ msg: 'Commande non livrée' });

    const existing = await Avis.findOne({ commande, reviewerRole: 'chauffeur' });
    if (existing) return res.status(400).json({ msg: 'Avis déjà soumis' });

    const avis = await Avis.create({
      commande,
      client:        cmd.client,
      chauffeur:     req.user.id,
      note,
      tags:          [...(issues ?? []), ...(positives ?? [])],
      accessFacile:  accessFacile ?? true,
      clientPresent: clientPresent ?? true,
      reviewerRole:  'chauffeur',
    });

    res.json(avis);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
