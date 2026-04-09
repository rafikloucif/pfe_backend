module.exports = function(role) {
  return function(req, res, next) {
    // ✅ FIXED: also check secondaryRole so a gerant acting as chauffeur isn't blocked
    if (req.user.role !== role && req.user.secondaryRole !== role) {
      return res.status(403).json({ msg: "access denied" });
    }
    next();
  }
}