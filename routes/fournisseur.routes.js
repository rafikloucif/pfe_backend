const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");

const user = require("../models/user");


router.post("/add-info",auth,role("fournisseur"),async(req,res)=>{

 const {quantiteEau,wilayas} = req.body;

 const user = await user.findById(req.user.id);

 user.fournisseurInfo = {
  quantiteEau,
  wilayas
 };

 await user.save();

 res.json({
  msg:"info added"
 });

});

module.exports = router;