const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const validator = require("validator");


// REGISTER
router.post("/register", async(req,res)=>{

 const {nom,prenom,telephone,email,password,adresse} = req.body;

if (!validator.isEmail(email)) {
  return res.status(400).json({ msg: "Invalid email" });
}

 if (!email.endsWith("@gmail.com")) {
  return res.status(400).json({ msg: "Only Gmail allowed" });
}

if (password.length < 6) {
  return res.status(400).json({ msg: "Password must be at least 6 characters" });
} 

 const userExists = await User.findOne({email});

 if(userExists){
  return res.status(400).json({
   msg:"email already used"
  });
 }

 const hashedPassword = await bcrypt.hash(password,10);

 const user = new User({
  nom,
  prenom,
  telephone,
  email,
  password:hashedPassword,
  adresse
 });

 await user.save();

 res.json({
  msg:"user created",
  userId:user._id
 });

});


// LOGIN
router.post("/login", async(req,res)=>{

 const {email,password} = req.body;

 
  if (!email || !password) {
    return res.status(400).json({ msg: "Email et password obligatoires" });
  }

 const user = await User.findOne({email});

 if(!user){
  return res.status(404).json({
   msg:"user not found"
  });
 }

 const match = await bcrypt.compare(password,user.password);

 if(!match){
  return res.status(401).json({
   msg:"wrong password"
  });
 }

   const token = jwt.sign({ id: client._id }, process.env.JWT_SECRET); 
 
 res.json({
   message: `Hello ${user.nom}`,
   token,
   user: {
     id: user._id,
     nom: user.nom,
     email: user.email
   }
 });

});


// CHOOSE ROLE (once only)
router.post("/choose-role", async(req,res)=>{

 const {userId,role} = req.body;

 const user = await User.findById(userId);

 if(user.role){
  return res.status(400).json({
   msg:"role already chosen"
  });
 }

 user.role = role;

 await user.save();

 res.json({
  msg:"role saved",
  role:user.role
 });

});

module.exports = router;