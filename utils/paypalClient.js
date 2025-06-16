// utils/paypalClient.js
const paypal = require('@paypal/paypal-server-sdk'); // Use the new SDK
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT
} = require('../config/appConfig');

/**
 * Returns the PayPal SDK environment based on the configuration.
 * @returns {paypal.core.SandboxEnvironment | paypal.core.LiveEnvironment}
 */
const environment = () => {
  if (PAYPAL_ENVIRONMENT === 'live') {
    return new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
  }
  // Default to Sandbox if not 'live' or if PAYPAL_ENVIRONMENT is not set explicitly
  return new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
};

/**
 * PayPal HTTP client instance configured for the specified environment.
 */
const client = new paypal.core.PayPalHttpClient(environment());

/**
 * Helper function to pretty-print JSON responses from PayPal (for logging).
 * @param {object} jsonResponse - The JSON response from PayPal.
 * @param {boolean} prettify - Whether to pretty-print the JSON.
 */
// async function prettyPrint(jsonResponse, prettify = false) {
//   if (prettify) {
//     console.log(JSON.stringify(jsonResponse, null, 4));
//   } else {
//     console.log(jsonResponse);
//   }
// }
// The prettyPrint function is a utility that might be useful for debugging PayPal responses later,
// but not strictly necessary for the client itself. We can add it if needed during controller implementation.

module.exports = {
  client,
  // environment // Optionally export environment if needed elsewhere, client is usually enough
};
