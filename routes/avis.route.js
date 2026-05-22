const express = require('express');
const router  = express.Router();
const Avis    = require('../models/Avis');
const Commande= require('../models/commande');
const User    = require('../models/user');
const Chauffeur = require('../models/chauffeur'); // ← add this
const auth    = require('../middleware/auth');
const role    = require('../middleware/role');

// POST /api/avis/client  — client rates the chauffeur
router.post('/client', auth, role('client'), async (req, res) => {
  try {
    const { commande, note, tags, commentaire } = req.body;
    const cmd = await Commande.findById(commande).populate('chauffeur');
    if (!cmd)
      return res.status(404).json({ msg: 'Commande introuvable' });
    if (cmd.client.toString() !== req.user.id)
      return res.status(403).json({ msg: 'Accès refusé' });
    if (cmd.status !== 'livrée')
      return res.status(400).json({ msg: 'Commande non livrée' });
    const existing = await Avis.findOne({ commande, reviewerRole: 'client' });
    if (existing)
      return res.status(400).json({ msg: 'Avis déjà soumis' });

    const avis = await Avis.create({
      commande,
      client:       req.user.id,
      chauffeur:    cmd.chauffeur?._id ?? null,
      note,
      tags:         tags ?? [],
      commentaire:  commentaire ?? '',
      reviewerRole: 'client',
    });

    // ── Recalculate & update noteMoyenne in both collections ─────
    if (avis.chauffeur) {
      const allAvis = await Avis.find({
        chauffeur:    avis.chauffeur,
        reviewerRole: 'client',
      });
      const total       = allAvis.reduce((sum, a) => sum + a.note, 0);
      const noteMoyenne = Math.round((allAvis.length > 0 ? total / allAvis.length : 0) * 10) / 10;

      // Update User document (chauffeur with role:'chauffeur')
      const userUpdated = await User.findByIdAndUpdate(
        avis.chauffeur,
        { noteMoyenne },
        { new: true }
      );

      // Update Chauffeur document (matched by telephone since _id differs)
      const chauffeurUpdated = await Chauffeur.findOneAndUpdate(
        { telephone: userUpdated?.telephone },
        { noteMoyenne },
        { new: true }
      );

      console.log(`[AVIS] noteMoyenne=${noteMoyenne}`);
      console.log(`[AVIS] User updated: ${!!userUpdated}, Chauffeur doc updated: ${!!chauffeurUpdated}`);
    }
    // ─────────────────────────────────────────────────────────────

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
    if (!cmd)
      return res.status(404).json({ msg: 'Commande introuvable' });
    if (cmd.status !== 'livrée')
      return res.status(400).json({ msg: 'Commande non livrée' });
    const existing = await Avis.findOne({ commande, reviewerRole: 'chauffeur' });
    if (existing)
      return res.status(400).json({ msg: 'Avis déjà soumis' });

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