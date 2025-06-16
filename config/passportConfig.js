// config/passportConfig.js
const LocalStrategy = require('passport-local').Strategy;
// const bcrypt = require('bcrypt'); // No longer directly needed here if User model handles comparison
const User = require('../models/userModel'); // Import Mongoose User model

module.exports = function(passport) {
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        // Mongoose User model expects username to be lowercase as defined in schema
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
          return done(null, false, { message: 'Incorrect username or user not found.' });
        }

        // Use the comparePassword method from the User model
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user); // User authenticated
      } catch (err) {
        return done(err); // Error during database query or other issue
      }
    }
  ));

  // passport.serializeUser and passport.deserializeUser are no longer needed for JWT
  // as user information is not stored in a session.
  // The authenticateToken middleware will fetch user info based on token.
};
