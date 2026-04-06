require('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const express = require('express');
const connectDB = require('./config/db');
const positionRoutes = require('./routes/position.route');

const app = express();

const VRP_API = process.env.VRP_API || 'http://localhost:8000/';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// ── Connect database ──────────────────────────────────────
connectDB();

// ── Load models BEFORE routes ─────────────────────────────
// ✅ This ensures mongoose registers all models before any
//    route tries to use .populate() or ref them
require('./models/user');
require('./models/chauffeur');
require('./models/commande');

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(limiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth.route'));
app.use('/api/clients',     require('./routes/client.routes'));
app.use('/api/fournisseurs',require('./routes/fournisseur.routes'));
app.use('/api/chauffeurs',  require('./routes/chauffeur.routes'));
app.use('/api/commandes',   require('./routes/commande.routes'));
app.use('/api/position',    positionRoutes);



// ── Handler d'erreur global ──────────────────────────────────────
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
 
   await axios.post(`${VRP_API}`/setup/conducteurs, {
  conducteurs: chauffeurs.map(c => ({
    id: c._id.toString().slice(-6), // 6 derniers chars de l'ObjectId
    lat: c.position.lat,
    lon: c.position.lon,
    capacity: c.fournisseurInfo?.quantiteEau || 1000,
    nom: `${c.nom || ""} ${c.prenom || ""}`.trim() || `Chauffeur ${c._id}`
  })),
});

console.log(`VRP initialisé avec ${chauffeurs.length} chauffeur(s)`);
  } catch (err) {
    // Ne pas bloquer le démarrage si le VRP est inaccessible
    console.warn('VRP non initialisé au démarrage :', err.message);
  }
};






const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});