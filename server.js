require('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const express = require('express');
const connectDB = require('./config/db');
const aiRoutes = require('./routes/ai.routes');
const positionRoutes = require('./routes/position.route');

const app = express();

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
app.use('/api/ai',          aiRoutes);
app.use('/api/position',    positionRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});