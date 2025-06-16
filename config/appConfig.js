// config/appConfig.js
require('dotenv').config(); // Load environment variables from .env file

const PORT = process.env.PORT || 3000;

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: PORT,
  // Default MONGODB_URI now includes 'counton_db'
  MONGODB_URI: process.env.MONGODB_URI || `mongodb://localhost:27017/counton_db`,
  SERVER_BASE_URL: process.env.SERVER_BASE_URL || `http://localhost:${PORT}`,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001', // Default example frontend
  SESSION_SECRET: process.env.SESSION_SECRET || 'your_very_long_random_and_secure_secret_string_here_appconfig', // Ensure this is consistent or managed centrally
  // Add other application-wide configurations here
  // Example for an external service:
  // EXTERNAL_API_SERVICE_URL: process.env.EXTERNAL_API_SERVICE_URL || 'https_default_external_api_url'
};
