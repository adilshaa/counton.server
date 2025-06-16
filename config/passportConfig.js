// config/passportConfig.js
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const { findUserByUsername, findUserById } = require('../models/userModel');

module.exports = function(passport) {
  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        const user = findUserByUsername(username);
        if (!user) {
          return done(null, false, { message: 'Incorrect username.' });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    try {
      const user = findUserById(id);
      done(null, user); // Passport handles if user is undefined (not found)
    } catch (err) {
      done(err);
    }
  });
};
