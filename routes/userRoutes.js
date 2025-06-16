// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// const { isAuthenticated } = require('../middleware/authMiddleware'); // Old session-based middleware
const authenticateToken = require('../middleware/authenticateToken'); // New JWT-based middleware

// @route   GET /profile (assuming mounted at / in routes/index.js)
// @desc    Get current user's profile
// @access  Private (JWT Authenticated)
router.get('/profile', authenticateToken, userController.getUserProfile);

// @route   GET /api/data
// @desc    Get some protected data
// @access  Private (JWT Authenticated)
router.get('/api/data', authenticateToken, userController.getProtectedData);

module.exports = router;
