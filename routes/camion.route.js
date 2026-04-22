const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const User = require('../models/user');
const Camion = require('../models/camion');

// ─── GET MY CAMIONS (gérant) ──────────────────────────────────────
// Same pattern as GET /chauffeurs/my
router.get('/my', auth, role('gerant'), async (req, res) => {
  try {
    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: 'Gérant non trouvé' });

    const camions = await Camion.find({
      _id: { $in: gerant.gerantInfo.camions }
    });

    res.json(camions);
  } catch (err) {
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
});

// ─── ADD CAMION (gérant) ──────────────────────────────────────────
router.post('/add', auth, role('gerant'), async (req, res) => {
  try {
    const { name, plate, capacity, model, year, lastService, nextService } = req.body;

    if (!name || !plate || !capacity) {
      return res.status(400).json({ error: 'name, plate, capacity sont obligatoires' });
    }

    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: 'Gérant non trouvé' });

    // Create the camion
    const camion = new Camion({
      gerant: req.user.id,
      name, plate, capacity, model, year, lastService, nextService
    });
    await camion.save();

    // Push into gerantInfo.camions — same as chauffeurs pattern
    await User.findByIdAndUpdate(req.user.id, {
      $push: { 'gerantInfo.camions': camion._id }
    });

    res.status(201).json(camion);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Immatriculation déjà existante' });
    }
    res.status(500).json({ error: err.message });
  }
});
// ─── UPDATE CAMION (gérant) ───────────────────────────────────────
router.put('/:id', auth, role('gerant'), async (req, res) => {
  try {
    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: 'Gérant non trouvé' });

    // Make sure this camion belongs to this gérant
    const isOwned = gerant.gerantInfo.camions
      .map(id => id.toString())
      .includes(req.params.id);

    if (!isOwned) return res.status(403).json({ msg: 'Non autorisé' });

    const camion = await Camion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(camion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE CAMION (gérant) ───────────────────────────────────────
// Same pattern as DELETE /chauffeurs/:id
router.delete('/:id', auth, role('gerant'), async (req, res) => {
  try {
    const gerant = await User.findById(req.user.id);
    if (!gerant) return res.status(404).json({ msg: 'Gérant non trouvé' });

    const isOwned = gerant.gerantInfo.camions
      .map(id => id.toString())
      .includes(req.params.id);

    if (!isOwned) return res.status(403).json({ msg: 'Non autorisé' });

    await Camion.findByIdAndDelete(req.params.id);

    // Pull from gerantInfo.camions — same as chauffeurs pattern
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { 'gerantInfo.camions': req.params.id }
    });

    res.json({ msg: 'Camion supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;