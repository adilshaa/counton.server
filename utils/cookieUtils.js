// utils/cookieUtils.js
const { NODE_ENV, REFRESH_TOKEN_COOKIE_MAX_AGE } = require('../config/appConfig');

/**
 * Returns an options object for setting the refresh token cookie.
 * Attributes are determined based on the application environment.
 */
const getRefreshTokenCookieOptions = () => {
  const isProduction = NODE_ENV === 'production';

  // For SameSite=None to work, Secure must be true.
  // For development on http://localhost, SameSite=Lax is more forgiving
  // and doesn't strictly require Secure=true, allowing HTTP.
  // If frontend and backend are on different localhost ports,
  // Lax should still generally work for top-level navigation and subsequent fetches
  // IF the frontend fetch includes credentials.

  return {
    httpOnly: true,
    secure: isProduction, // Secure flag is true only in production (requires HTTPS)
    sameSite: isProduction ? 'None' : 'Lax', // Lax for development, None for production cross-site
    path: '/',
    maxAge: parseInt(REFRESH_TOKEN_COOKIE_MAX_AGE, 10) // Ensure it's a number from config
  };
};

/**
 * Returns options for clearing the refresh token cookie.
 * These should match the options used when setting the cookie, except for maxAge/expires.
 */
const getClearRefreshTokenCookieOptions = () => {
    const isProduction = NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'None' : 'Lax',
        path: '/',
    };
};

module.exports = {
  getRefreshTokenCookieOptions,
  getClearRefreshTokenCookieOptions
};
