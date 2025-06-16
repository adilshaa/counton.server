// controllers/authController.js
// bcrypt is no longer directly needed here for hashing, as it's handled by the User model's pre-save hook
// const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/userModel'); // Import Mongoose User model

const registerUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Basic validation (can be enhanced, e.g., with a validation library)
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    // Add more validation here if needed, e.g., password complexity, username format

    // Username is converted to lowercase by schema, but good to be consistent in query
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken.' });
    }

    // Create new user instance (password will be hashed by pre-save hook in User model)
    const newUser = new User({
      username: username, // Schema will handle lowercase
      password: password  // Schema will handle hashing
    });

    // Save the user to the database
    await newUser.save();

    // Log in the user directly after registration
    // req.login requires a callback
    req.login(newUser, (err) => {
      if (err) {
        // console.error("Error logging in after registration:", err); // For debugging
        // It's possible that the session setup might have an issue,
        // or some other problem during req.login.
        // We should inform the client that registration was successful but login failed.
        // Or, pass to global error handler. For now, let's pass to error handler.
        return next(err);
      }
      // Send response after successful login
      return res.status(201).json({
        message: 'User registered and logged in successfully.',
        userId: newUser.id // newUser.id is the Mongoose document _id
      });
    });

  } catch (error) {
    // Handle errors, e.g., validation errors from Mongoose or other issues
    if (error.name === 'ValidationError') {
      // Construct a user-friendly error message from Mongoose validation errors
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    // console.error("Error in registerUser:", error); // For debugging
    next(error); // Pass other errors to the global error handler
  }
};

// loginUser remains largely the same as it uses passport.authenticate,
// which now uses the Mongoose-aware LocalStrategy
const loginUser = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) {
      return res.status(401).json({ message: info ? info.message : 'Login failed. Check username or password.' });
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      return res.status(200).json({ message: 'Login successful', userId: user.id });
    });
  })(req, res, next);
};

// logoutUser remains the same
const logoutUser = (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error during logout:', err);
        return res.status(500).json({ message: 'Logout encountered an issue with session destruction.' });
      }
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout successful' });
    });
  });
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser
};
