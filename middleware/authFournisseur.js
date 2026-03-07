const jwt = require('jsonwebtoken');
const Fournisseur = require('../models/fournisseur');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization');

    if (!token) {
      return res.status(401).json({ msg: "No token" });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);

    const fournisseur = await Fournisseur.findById(verified.id);

    if (!fournisseur) {
      return res.status(401).json({ msg: "Invalid token" });
    }

    req.user = fournisseur._id;
    next();

  } catch (err) {
    res.status(401).json({ msg: "Token not valid" });
  }
};