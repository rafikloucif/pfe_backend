require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const aiRoutes = require('./routes/ai.routes');
const app = express();

// connect database
connectDB();

app.use(express.json());

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