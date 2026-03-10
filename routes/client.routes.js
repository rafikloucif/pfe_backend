const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const User = require("../models/user");


router.get("/fournisseurs",auth,role("client"),async(req,res)=>{

 const fournisseurs = await User.find({
  role:"fournisseur"
 });

 res.json(fournisseurs);

});

module.exports = router;