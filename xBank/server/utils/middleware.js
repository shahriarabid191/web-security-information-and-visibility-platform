// server/utils/middleware.js

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: 'Not logged in' });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'customer') {
    return res.status(403).json({ message: 'Customer access required' });
  }
  next();
}

function requireIT(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'IT_expert') {
    return res.status(403).json({ message: 'IT expert access required' });
  }
  next();
}

module.exports = { requireAuth, requireCustomer, requireIT };
