const jwt = require('jsonwebtoken');
const Client = require('../models/Client');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization');

    if (!token) {
      return res.status(401).json({ msg: "No token, access denied" });
    }

    const verified = jwt.verify(token, process.env.JWT_SECRET);

    const client = await Client.findById(verified.id);

    if (!client) {
      return res.status(401).json({ msg: "Invalid token" });
    }

    req.user = client._id;
    next();

  } catch (err) {
    res.status(401).json({ msg: "Token not valid" });
  }
};