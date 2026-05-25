// Auth middleware — migrated from Mongoose to Prisma
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Protect routes — verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired, please login again' });
    }
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Master admin only
const masterOnly = (req, res, next) => {
  if (req.user.role !== 'master_admin') {
    return res.status(403).json({
      success: false,
      message: 'Only master admin can access this route',
    });
  }
  next();
};

// Admin or master admin
const adminAccess = (req, res, next) => {
  if (!['admin', 'master_admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

module.exports = { protect, authorize, masterOnly, adminAccess };
