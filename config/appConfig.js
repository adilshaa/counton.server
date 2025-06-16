// config/appConfig.js
require('dotenv').config(); // Load environment variables from .env file

const PORT = process.env.PORT || 3000;

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: PORT,
  MONGODB_URI: process.env.MONGODB_URI || `mongodb://localhost:27017/counton_db`,
  SERVER_BASE_URL: process.env.SERVER_BASE_URL || `http://localhost:${PORT}`,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001', // Default example frontend

  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'your_access_token_secret_ 매우_안전해야_합니다', // Replace with a strong random string
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret_더_안전해야_합니다', // Replace with a different strong random string
  ACCESS_TOKEN_EXPIRATION: process.env.ACCESS_TOKEN_EXPIRATION || '15m', // e.g., 15 minutes
  REFRESH_TOKEN_EXPIRATION: process.env.REFRESH_TOKEN_EXPIRATION || '7d',  // e.g., 7 days
  REFRESH_TOKEN_COOKIE_NAME: 'jid', // Example name for the refresh token cookie
  REFRESH_TOKEN_COOKIE_MAX_AGE: process.env.REFRESH_TOKEN_COOKIE_MAX_AGE || 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds,

  // PayPal Settings
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || '', // Must be set in .env
  PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET || '', // Must be set in .env
  PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT || 'sandbox', // 'sandbox' or 'live'

  // Subscription Plan Details (for the single 'monthly_standard' plan)
  SUBSCRIPTION_PLAN_ID: 'monthly_standard_10_usd', // An internal identifier for your plan
  SUBSCRIPTION_PRICE: '10.00', // Price as a string, as per PayPal SDK examples
  SUBSCRIPTION_CURRENCY: 'USD'
  // Add other application-wide configurations here
  // Example for an external service:
  // EXTERNAL_API_SERVICE_URL: process.env.EXTERNAL_API_SERVICE_URL || 'https_default_external_api_url'
};
