// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// @route   POST /register (will be /auth/register if router is mounted at /auth)
// @desc    Register a new user
// @access  Public
router.post('/register', authController.registerUser);

// @route   POST /login (will be /auth/login if router is mounted at /auth)
// @desc    Login user
// @access  Public
router.post('/login', authController.loginUser);

// @route   POST /logout (will be /auth/logout if router is mounted at /auth)
// @desc    Logout user
// @access  Private (implicitly, as you need to be logged in to log out)
router.post('/logout', authController.logoutUser);

module.exports = router;
