module.exports = function(role){

 return function(req,res,next){

  if(req.User.role !== role){
   return res.status(403).json({
    msg:"access denied"
   });
  }

  next();

 }

}