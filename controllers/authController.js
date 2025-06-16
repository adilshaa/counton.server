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
  REFRESH_TOKEN_COOKIE_MAX_AGE, // Still needed for DB expiry calculation
  // NODE_ENV // No longer needed directly here
} = require('../config/appConfig'); // Import cookie/env configurations
// Cookie utilities are no longer used as refresh tokens are in request/response body
// const {
//   getRefreshTokenCookieOptions,
//   getClearRefreshTokenCookieOptions
// } = require('../utils/cookieUtils');

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

    // Store the refresh token and its expiry in the database
    newUser.currentRefreshToken = refreshToken;
    // REFRESH_TOKEN_COOKIE_MAX_AGE is already in milliseconds from appConfig
    newUser.currentRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);

    await newUser.save(); // Save again to store refresh token details

    // res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions()); // Cookie removed

    return res.status(201).json({
      message: 'User registered successfully.',
      accessToken,
      refreshToken, // refreshToken added to response body
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

      // Store the new refresh token and its expiry in the database
      user.currentRefreshToken = refreshToken;
      // REFRESH_TOKEN_COOKIE_MAX_AGE is already in milliseconds from appConfig
      user.currentRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);

      await user.save(); // Save again to store refresh token details

      // res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions()); // Cookie removed

      res.status(200).json({
        message: 'Login successful.',
        accessToken,
        refreshToken, // refreshToken added to response body
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

const logoutUser = async (req, res, next) => {
  // Client is responsible for discarding its access token and the refresh token from its storage (e.g., localStorage).
  // Server's main responsibility is to invalidate the refresh token if it's stored server-side.

  const { refreshToken: refreshTokenFromBody } = req.body;

  // No Cache header
  res.setHeader('Cache-Control', 'no-store');

  if (!refreshTokenFromBody) {
    // If client doesn't send a refresh token, there's nothing specific for the server to invalidate based on that token.
    // The client should still clear its stored tokens.
    return res.status(200).json({ message: 'Logout signal received. Client should clear tokens. No server-side refresh token provided for invalidation.' });
  }

  try {
    const decodedRefreshToken = verifyRefreshToken(refreshTokenFromBody);

    if (decodedRefreshToken && decodedRefreshToken.id) {
      // If token is validly signed and has an ID, attempt to find user and clear their DB token
      // only if the provided token matches the current one.
      const user = await User.findOneAndUpdate(
        {
          _id: decodedRefreshToken.id,
          currentRefreshToken: refreshTokenFromBody // Only invalidate if this exact token is the current one
        },
        {
          $set: {
            currentRefreshToken: null,
            currentRefreshTokenExpiresAt: null
          }
        },
        { new: false }
      );

      // If 'user' is null here, it means no document matched (either user_id was wrong,
      // or more likely, the refreshTokenFromBody was not the currentRefreshToken in the DB).
      // This is fine, means the token was already invalid or superseded.
      if (user) {
        // console.log(`Invalidated refresh token for user: ${user._id}`);
        return res.status(200).json({ message: 'Logout successful. Refresh token invalidated on server. Client should clear tokens.' });
      } else {
        return res.status(200).json({ message: 'Logout successful. Refresh token provided was not active or found. Client should clear tokens.' });
      }
    } else {
      // Token was malformed or signature invalid
      return res.status(200).json({ message: 'Logout successful. Invalid refresh token provided, no server-side invalidation based on it. Client should clear tokens.' });
    }

  } catch (error) {
    // console.error("Error during server-side logout operations:", error);
    // Even with a server error, the client should proceed to clear its tokens.
    return res.status(500).json({ message: 'Logout processed with server error during token invalidation. Client should clear tokens.' });
  }
};

const handleRefreshToken = async (req, res, next) => {
  const { refreshToken: refreshTokenFromBody } = req.body; // Get token from request body

  if (!refreshTokenFromBody) {
    return res.status(401).json({ message: 'Unauthorized: No refresh token provided in request body.' });
  }

  const decodedRefreshToken = verifyRefreshToken(refreshTokenFromBody);

  if (!decodedRefreshToken || !decodedRefreshToken.id) {
    // No cookie to clear here
    return res.status(403).json({ message: 'Forbidden: Invalid refresh token signature or payload.' });
  }

  try {
    // Fetch user and explicitly select the refresh token fields
    const user = await User.findById(decodedRefreshToken.id).select('+currentRefreshToken +currentRefreshTokenExpiresAt');

    if (!user) {
      // No cookie to clear
      return res.status(403).json({ message: 'Forbidden: User not found for refresh token.' });
    }

    // Verify the token from body against the one stored in DB and check its DB expiry
    if (!user.currentRefreshToken ||
        user.currentRefreshToken !== refreshTokenFromBody || // Compare with token from body
        (user.currentRefreshTokenExpiresAt && new Date() > user.currentRefreshTokenExpiresAt)) {

      user.currentRefreshToken = null;
      user.currentRefreshTokenExpiresAt = null;
      await user.save();

      // No cookie to clear
      return res.status(403).json({ message: 'Forbidden: Refresh token is invalid, expired, or has been reused. Please log in again.' });
    }

    // --- Refresh token is valid and matches DB store ---

    // Generate new access token
    const userPayloadForAccessToken = { id: user._id, username: user.username };
    const newAccessToken = generateAccessToken(userPayloadForAccessToken);

    // Implement Refresh Token Rotation: Generate a new refresh token
    const userPayloadForNewRefreshToken = { id: user._id };
    const newRefreshToken = generateRefreshToken(userPayloadForNewRefreshToken);

    // Update the stored refresh token and its expiry in the database
    user.currentRefreshToken = newRefreshToken;
    // REFRESH_TOKEN_COOKIE_MAX_AGE is already in milliseconds from appConfig
    user.currentRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);
    await user.save();

    // Set the new refresh token in the HttpOnly cookie - REMOVED
    // res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, getRefreshTokenCookieOptions());

    return res.status(200).json({
      message: 'Access token refreshed successfully.',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken // newRefreshToken added to response body
    });

  } catch (error) {
    // console.error("Error in handleRefreshToken:", error);
    // No cookie to clear
    return res.status(500).json({ message: 'Internal server error during token refresh.' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  handleRefreshToken
};
