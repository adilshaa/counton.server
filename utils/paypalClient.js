// utils/paypalClient.js
const { Client, Environment } = require("@paypal/paypal-server-sdk"); // Using destructuring as per user's code
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT,
} = require("../config/appConfig");

/**
 * Returns the PayPal SDK environment instance based on the configuration.
 * Note: The user's code implies Environment.Production and Environment.Sandbox are
 * specific instances or enums provided by the SDK.
 */
const getPayPalEnvironment = () => {
  if (PAYPAL_ENVIRONMENT === "live") {
    // Assuming Environment.Production is a pre-configured live environment instance or enum value
    // This needs to align with how `@paypal/paypal-server-sdk` actually provides these.
    // If Environment is a class, this would be: new Environment.Live(...) or similar.
    // Given the user's code `return Environment.Production;`, we follow that structure.
    if (typeof Environment.Production === 'undefined') {
        console.warn("PayPal SDK Environment.Production is undefined. Falling back to string 'production'. This might indicate an SDK usage issue or version change.");
        return 'production'; // Fallback, but SDK might expect an instance.
    }
    return Environment.Production;
  }
  // Default to Sandbox
  if (typeof Environment.Sandbox === 'undefined') {
      console.warn("PayPal SDK Environment.Sandbox is undefined. Falling back to string 'sandbox'. This might indicate an SDK usage issue or version change.");
      return 'sandbox'; // Fallback
  }
  return Environment.Sandbox;
};

/**
 * PayPal API client instance configured for the specified environment.
 */
const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  environment: getPayPalEnvironment(), // Call the function to get the environment value/instance
  timeout: 60000, // 60 seconds timeout
});

/**
 * Helper function to pretty-print JSON responses from PayPal (for logging).
 * @param {object} jsonResponse - The JSON response from PayPal.
 * @param {boolean} prettify - Whether to pretty-print the JSON.
 */
async function prettyPrint(jsonResponse, prettify = false) {
  if (prettify) {
    console.log(JSON.stringify(jsonResponse, null, 4));
  } else {
    console.log(jsonResponse);
  }
}

module.exports = {
  client,
  prettyPrint, // Exporting this as user included it in their example exports
  // getPayPalEnvironment, // Not exporting getPayPalEnvironment as client is the main export needed
};
