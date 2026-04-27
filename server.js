require('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const express = require('express');
const axios = require('axios'); // ✅ FIXED: was missing
const connectDB = require('./config/db');
const positionRoutes = require('./routes/position.route');
const auth = require('./middleware/auth');

const app = express();

const VRP_API = process.env.VRP_API_URL || 'https://pfebackendpython.onrender.com';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// ── Connect database ──────────────────────────────────────
connectDB();

// ── Load models BEFORE routes ─────────────────────────────
require('./models/user');
require('./models/commande');
require('./models/camion');

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(limiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth.route'));
app.use('/api/admin',        require('./routes/admin.route'));
app.use('/api/clients',     require('./routes/client.routes'));
app.use('/api/fournisseurs',require('./routes/fournisseur.routes'));
app.use('/api/camions',require('./routes/camion.route'));
app.use('/api/commandes',   require('./routes/commande.routes'));
app.use('/api/position',    positionRoutes);

// ── AI / VRP proxy routes ─────────────────────────────────
// Flutter calls these; Node forwards to FastAPI and returns the result.

// POST /api/ai/optimise — trigger full NSGA-II optimisation
app.post('/api/ai/optimise', auth, async (req, res) => {
  try {
    const response = await axios.post(`${VRP_API}/optimize`, req.body || {});
    res.json(response.data);
  } catch (err) {
    console.error('VRP /optimize error:', err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ msg: "Erreur VRP", error: err.response?.data || err.message });
  }
});

// GET /api/ai/solution — fetch the current optimised solution
app.get('/api/ai/solution', auth, async (req, res) => {
  try {
    const response = await axios.get(`${VRP_API}/optimisation/solution`);
    res.json(response.data);
  } catch (err) {
    console.error('VRP /solution error:', err.message);
    const status = err.response?.status || 502;
    res.status(status).json({ msg: "Erreur VRP", error: err.response?.data || err.message });
  }
});

// ── Handler d'erreur global ───────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: "Erreur serveur interne" });
});

// ── Initialisation du backend VRP au démarrage ───────────────────
// Envoie les chauffeurs en ligne au backend Python pour qu'il
// puisse construire la matrice de distances et être prêt à optimiser
// dès la première commande acceptée.
const initVRP = async () => {
  try {
    const User = require('./models/user');

    const chauffeurs = await User.find({
      role: "chauffeur",
      isOnline: true,
      "position.lat": { $ne: null },
      "position.lon": { $ne: null }
    });

    if (chauffeurs.length === 0) {
      console.log('VRP : aucun chauffeur en ligne au démarrage');
      return;
    }

    // ✅ FIXED: backtick template literal was broken, VRP_API was missing axios
    await axios.post(`${VRP_API}/setup/conducteurs`, {
      conducteurs: chauffeurs.map(c => ({
        id: c.vrpId || parseInt(c._id.toString().slice(-6), 16) % 100000,
        lat: c.position.lat,
        lon: c.position.lon,
        capacity: c.fournisseurInfo?.quantiteEau || 1000,
        nom: `${c.nom || ""} ${c.prenom || ""}`.trim() || `Chauffeur ${c._id}`
      }))
    });

    console.log(`VRP initialisé avec ${chauffeurs.length} chauffeur(s)`);
  } catch (err) {
    // Ne pas bloquer le démarrage si le VRP est inaccessible
    console.warn('VRP non initialisé au démarrage :', err.message);
  }
};

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  initVRP(); // ✅ FIXED: was defined but never called
});