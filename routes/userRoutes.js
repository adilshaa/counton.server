// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/authMiddleware');

// @route   GET /profile (e.g., /users/profile if mounted at /users)
// @desc    Get current user's profile
// @access  Private
router.get('/profile', isAuthenticated, userController.getUserProfile);

// @route   GET /api/data (e.g., /users/api/data if mounted at /users)
// @desc    Get some protected data
// @access  Private
router.get('/api/data', isAuthenticated, userController.getProtectedData);

module.exports = router;
