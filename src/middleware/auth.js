const jwt=require("jsonwebtoken");
const {getDb} =require("../models/db");
const JWT_SECRET =process.env.JWT_SECRET || "finance_secret_key_change_in_prod";



function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please login first." });
  }

  const token =authHeader.split(" ")[1];
  try {
    const decoded =jwt.verify(token,JWT_SECRET);

    const user = getDb()
      .prepare("SELECT id,name,email,role, status FROM users WHERE id = ?")
      .get(decoded.userId);

    if (!user) {
      
      
      return res.status(401).json({ error:"User not found." });
    }
    if (user.status=== "inactive") {
      return res.status(403).json({ error:"Your account has been deactivated." });
    
    }

    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error:"Invalid or expired token." });
  }
}

// role-based access passed allowed roles as array(Aditya)
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. This action requires one of these roles: ${roles.join(", ")}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
}

function generateToken(userId){
  return jwt.sign({ userId }, JWT_SECRET,{expiresIn: "24h"});
}

module.exports ={authenticate,authorize,generateToken};
