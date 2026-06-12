import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Token can be sent in Header as "Bearer <token>" or as cookie or simple query param
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'supersecretplanedgekey123!';
    const user = jwt.verify(token, secret);
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden. Admin role required.' });
  }
  
  next();
};

export default {
  authenticateToken,
  requireAdmin,
};
