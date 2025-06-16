// utils/tokenUtils.js
const jwt = require('jsonwebtoken');
const {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRATION,
  REFRESH_TOKEN_EXPIRATION
} = require('../config/appConfig');

/**
 * Generates an access token.
 * @param {object} userPayload - The user data to include in the token (e.g., { id: user._id, username: user.username }).
 * @returns {string} The generated access token.
 */
const generateAccessToken = (userPayload) => {
  return jwt.sign(
    userPayload,
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRATION }
  );
};

/**
 * Generates a refresh token.
 * @param {object} userPayload - The user data to include in the token (e.g., { id: user._id }).
 *                               It's common for refresh tokens to have minimal user data, primarily the user ID,
 *                               and potentially a version/counter for invalidation.
 * @returns {string} The generated refresh token.
 */
const generateRefreshToken = (userPayload) => {
  return jwt.sign(
    userPayload,
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRATION }
  );
};

/**
 * Verifies a refresh token.
 * @param {string} token - The refresh token to verify.
 * @returns {object|null} The decoded payload if valid, otherwise null.
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    // console.error('Invalid refresh token:', error.message);
    return null;
  }
};

/**
 * Verifies an access token.
 * @param {string} token - The access token to verify.
 * @returns {object|null} The decoded payload if valid, otherwise null.
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    // console.error('Invalid access token:', error.message);
    return null;
  }
};


module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyAccessToken
};
