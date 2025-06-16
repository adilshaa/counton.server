// controllers/authController.js
// bcrypt is no longer directly needed here for hashing, as it's handled by the User model's pre-save hook
// const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/userModel'); // Import Mongoose User model
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} = require('../utils/tokenUtils'); // Import token utilities
const {
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_MAX_AGE,
  NODE_ENV
} = require('../config/appConfig'); // Import cookie/env configurations

// registerUser needs to be updated to return tokens instead of logging in via session
const registerUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken.' });
    }

    // Create new user instance. isActive, subscriptionPlan, subscriptionStatus will use schema defaults.
    const newUser = new User({
      username,
      password,
      lastLoginAt: new Date() // Set lastLoginAt as registration logs them in
    });
    await newUser.save();

    // Generate tokens for the new user
    const userPayloadForAccessToken = { id: newUser._id, username: newUser.username };
    const userPayloadForRefreshToken = { id: newUser._id }; // Or add a version/counter

    const accessToken = generateAccessToken(userPayloadForAccessToken);
    const refreshToken = generateRefreshToken(userPayloadForRefreshToken);

    // TODO (Optional): Store refresh token (hashed) in DB associated with user for invalidation

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production', // Send only over HTTPS in production
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
      // sameSite: 'Lax' or 'Strict' // Consider SameSite attribute
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      accessToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        isActive: newUser.isActive, // Reflect schema default
        lastLoginAt: newUser.lastLoginAt, // Reflect value set above
        subscriptionStatus: newUser.subscriptionStatus, // Reflect schema default
        subscriptionPlan: newUser.subscriptionPlan // Reflect schema default
      }
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    next(error);
  }
};

const loginUser = (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => { // Make callback async
    if (err) { return next(err); }
    if (!user) {
      return res.status(401).json({ message: info ? info.message : 'Login failed. Check username or password.' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Forbidden: Your account is inactive. Please contact support.' });
    }

    try {
      // Update lastLoginAt
      user.lastLoginAt = new Date();
      await user.save(); // Save the updated user document

      // User is authenticated and active, now generate tokens
      const userPayloadForAccessToken = { id: user._id, username: user.username };
      const userPayloadForRefreshToken = { id: user._id };

      const accessToken = generateAccessToken(userPayloadForAccessToken);
      const refreshToken = generateRefreshToken(userPayloadForRefreshToken);

      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
      });

      res.status(200).json({
        message: 'Login successful.',
        accessToken,
        user: {
          id: user._id,
          username: user.username,
          // Optionally return other non-sensitive fields like isActive, lastLoginAt, subscriptionStatus
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          subscriptionStatus: user.subscriptionStatus
        }
      });
    } catch (saveError) {
      // console.error("Error saving user during login (lastLoginAt update):", saveError);
      return next(saveError); // Pass to global error handler
    }
  })(req, res, next);
};

const logoutUser = (req, res, next) => {
  // The primary responsibility of JWT logout on the server is to invalidate means of getting new access tokens.
  // This means clearing the refresh token cookie.
  // The access token is stateless and will simply expire on its own.
  // The client should also discard the access token from its memory/storage.

  // TODO (Future Enhancement): If storing refresh tokens or their versions/identifiers on the server-side
  // (e.g., in the User model or a separate collection for an allowlist/denylist),
  // you would invalidate the specific refresh token here.
  // For example, by removing it from the allowlist or adding its JTI (JWT ID) to a denylist.
  // This would prevent the compromised/logged-out refresh token from being used again,
  // even if the cookie somehow persisted or was stolen before its natural expiry.

  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: NODE_ENV === 'production', // Match settings used when setting the cookie
    // sameSite: 'Strict' or 'Lax' // Should match how it was set
  });

  // It's also good practice to send a no-cache header to prevent client-side caching of the logout response.
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({ message: 'Logout successful. Please discard your access token.' });
};

const handleRefreshToken = async (req, res, next) => {
  const refreshTokenFromCookie = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshTokenFromCookie) {
    return res.status(401).json({ message: 'Unauthorized: No refresh token provided.' });
  }

  const decodedRefreshToken = verifyRefreshToken(refreshTokenFromCookie);

  if (!decodedRefreshToken || !decodedRefreshToken.id) {
    // Clear the potentially invalid refresh token cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        // sameSite: 'Strict' // Consider SameSite
    });
    return res.status(403).json({ message: 'Forbidden: Invalid or expired refresh token.' });
  }

  try {
    // TODO (Optional): Check against a DB allowlist/denylist of refresh tokens here for enhanced security.

    const user = await User.findById(decodedRefreshToken.id);
    if (!user) {
      // Clear cookie if user not found for a valid-looking token (security measure)
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === 'production' });
      return res.status(403).json({ message: 'Forbidden: User not found for refresh token.' });
    }

    // Generate new access token
    const userPayloadForAccessToken = { id: user._id, username: user.username };
    const newAccessToken = generateAccessToken(userPayloadForAccessToken);

    // Optional: Implement Refresh Token Rotation - Generate a new refresh token
    const userPayloadForNewRefreshToken = { id: user._id };
    const newRefreshToken = generateRefreshToken(userPayloadForNewRefreshToken);

    // TODO (Optional): If storing refresh tokens server-side, update the stored token here.

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
      // sameSite: 'Lax' or 'Strict'
    });

    return res.status(200).json({
      message: 'Access token refreshed successfully.',
      accessToken: newAccessToken
    });

  } catch (error) {
    // console.error("Error in handleRefreshToken:", error);
    // Clear cookie on unexpected error too
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === 'production' });
    return res.status(500).json({ message: 'Internal server error during token refresh.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  handleRefreshToken
};
