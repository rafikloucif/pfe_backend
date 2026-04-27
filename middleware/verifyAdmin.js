 const jwt = require('jsonwebtoken');
 module.exports = (req, res, next) => {
   const auth = req.headers.authorization;
   if (!auth) return res.status(401).json({ msg: 'No token' });
   try {
     const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
     // Option A: you store role in the token
     if (decoded.role !== 'admin') return res.status(403).json({ msg: 'Forbidden' });
     // Option B: you check a hardcoded admin email/id
     // if (decoded.email !== process.env.ADMIN_EMAIL) return res.status(403).json({ msg: 'Forbidden' });
     req.user = decoded;
     next();
  } catch (e) {
     return res.status(401).json({ msg: 'Invalid token' });
   }
 };