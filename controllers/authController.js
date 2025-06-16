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

    // Store the refresh token and its expiry in the database
    newUser.currentRefreshToken = refreshToken;
    // REFRESH_TOKEN_COOKIE_MAX_AGE is already in milliseconds from appConfig
    newUser.currentRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);

    await newUser.save(); // Save again to store refresh token details

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

      // Store the new refresh token and its expiry in the database
      user.currentRefreshToken = refreshToken;
      // REFRESH_TOKEN_COOKIE_MAX_AGE is already in milliseconds from appConfig
      user.currentRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE);

      await user.save(); // Save again to store refresh token details

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
const logoutUser = async (req, res, next) => {
  const refreshTokenFromCookie = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

  // Clear the cookie regardless of whether the token is found or valid on the server.
  // This ensures the client-side token is removed.
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    // sameSite: 'Strict' or 'Lax' // Should match how it was set
  });
  // It's also good practice to send a no-cache header to prevent client-side caching of the logout response.
  res.setHeader('Cache-Control', 'no-store');

  if (!refreshTokenFromCookie) {
    // No refresh token cookie found, so nothing to invalidate on the server for this specific "session".
    // Client-side cookie is cleared above.
    return res.status(200).json({ message: 'Logout successful (no active session cookie found or already cleared).' });
  }

  try {
    const decodedRefreshToken = verifyRefreshToken(refreshTokenFromCookie);

    if (decodedRefreshToken && decodedRefreshToken.id) {
      // If token is validly signed and has an ID, attempt to find user and clear their DB token.
      // We only clear the token if it matches the one provided, preventing one logout call from clearing a newer token
      // if a very old cookie was somehow submitted.
      const user = await User.findOneAndUpdate(
        {
          _id: decodedRefreshToken.id,
          currentRefreshToken: refreshTokenFromCookie // Only update if this is the current token
        },
        {
          $set: {
            currentRefreshToken: null,
            currentRefreshTokenExpiresAt: null
          }
        },
        { new: false } // Doesn't need to return the updated doc
      );

      // No error if user or token wasn't found or didn't match; cookie is cleared anyway.
      // The goal is to invalidate this specific refresh token if it was the active one.
    }
    // If token is malformed or signature invalid, decodedRefreshToken will be null.
    // In this case, we've already cleared the cookie, which is the main action.

    return res.status(200).json({ message: 'Logout successful. Session invalidated if active token was provided.' });

  } catch (error) {
    // console.error("Error during logout while trying to invalidate refresh token:", error);
    // Even if there's an error (e.g., DB issue), the client-side cookie is already cleared.
    // We can still send a success response for logout from client's perspective.
    return res.status(200).json({ message: 'Logout processed (client cookie cleared). Server error during token invalidation.' });
  }
};

const handleRefreshToken = async (req, res, next) => {
  const refreshTokenFromCookie = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

  if (!refreshTokenFromCookie) {
    return res.status(401).json({ message: 'Unauthorized: No refresh token provided.' });
  }

  const decodedRefreshToken = verifyRefreshToken(refreshTokenFromCookie);

  if (!decodedRefreshToken || !decodedRefreshToken.id) {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === 'production' });
    return res.status(403).json({ message: 'Forbidden: Invalid refresh token signature or payload.' });
  }

  try {
    // Fetch user and explicitly select the refresh token fields
    const user = await User.findById(decodedRefreshToken.id).select('+currentRefreshToken +currentRefreshTokenExpiresAt');

    if (!user) {
      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === 'production' });
      return res.status(403).json({ message: 'Forbidden: User not found for refresh token.' });
    }

    // Verify the token from cookie against the one stored in DB and check its DB expiry
    if (!user.currentRefreshToken ||
        user.currentRefreshToken !== refreshTokenFromCookie ||
        (user.currentRefreshTokenExpiresAt && new Date() > user.currentRefreshTokenExpiresAt)) {

      // Token reuse detected or stored token expired/invalidated.
      // Clear the potentially compromised/old token from DB for this user as a security measure.
      user.currentRefreshToken = null;
      user.currentRefreshTokenExpiresAt = null;
      await user.save();

      res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { httpOnly: true, secure: NODE_ENV === 'production' });
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

    // Set the new refresh token in the HttpOnly cookie
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    });

    return res.status(200).json({
      message: 'Access token refreshed successfully.',
      accessToken: newAccessToken
    });

  } catch (error) {
    // console.error("Error in handleRefreshToken:", error);
    // It's safer to clear the cookie on any unexpected error during the refresh process.
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
