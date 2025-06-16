// controllers/authController.js
const bcrypt = require('bcrypt');
const passport = require('passport');
const { findUserByUsername, addUser } = require('../models/userModel');

const registerUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(), // Simple ID generation
      username,
      password: hashedPassword
    };
    addUser(newUser);
    // console.log("User registered, new user:", newUser); // For debugging
    // console.log("All users after registration:", require('../models/userModel').getUsers()); // For debugging

    // Log in the user directly after registration
    req.login(newUser, (err) => {
      if (err) {
        // console.error("Error logging in after registration:", err); // For debugging
        return next(err);
      }
      return res.status(201).json({ message: 'User registered and logged in successfully', userId: newUser.id });
    });

  } catch (error) {
    // console.error("Error in registerUser:", error); // For debugging
    next(error); // Pass error to the global error handler
  }
};

const loginUser = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(401).json({ message: info ? info.message : 'Login failed' });
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      return res.status(200).json({ message: 'Login successful', userId: user.id });
    });
  })(req, res, next);
};

const logoutUser = (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error during logout:', err);
        // Still try to send a response, but log the error
        return res.status(500).json({ message: 'Logout encountered an issue with session destruction.' });
      }
      res.clearCookie('connect.sid'); // Default session cookie name
      res.status(200).json({ message: 'Logout successful' });
    });
  });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser
};
