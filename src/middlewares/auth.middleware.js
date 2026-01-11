const jwt = require("jsonwebtoken");

exports.protect = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "No token" });

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (roles.length && !roles.includes(decoded.role))
        return res.status(403).json({ message: "Forbidden" });

      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ message: "Invalid token" });
    }
  };
};
