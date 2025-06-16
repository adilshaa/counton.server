// middleware/authMiddleware.js
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { // .isAuthenticated() is added by Passport
    return next();
  }
  res.status(401).json({ message: 'You are not authorized to view this resource. Please log in.' });
}

module.exports = {
  isAuthenticated
};
