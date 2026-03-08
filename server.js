equire('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require=('express-rate-limit');
const express = require('express');
const connectDB = require('./config/db');
const aiRoutes = require('./routes/ai.routes');
const app = express();
const limiter =rateLimit({

windowMs: 15 * 60 * 1000,
max :100

});

// connect database
connectDB();

app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(limiter);

// routes
app.use('/api/clients', require('./routes/client.routes'));
app.use('/api/fournisseurs', require('./routes/fournisseur.routes'));
app.use('/api/chauffeurs', require('./routes/chauffeur.routes'));
app.use('/api/commandes', require('./routes/commande.routes'));
app.use('/api/ai',aiRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});