// server.js (Main Application File)
const express = require('express');
// const session = require('express-session'); // No longer needed for JWT auth
const passport = require('passport');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
// const cookieParser = require('cookie-parser'); // No longer needed

// Import configurations from appConfig.js
const { PORT, SESSION_SECRET, SERVER_BASE_URL, FRONTEND_URL, NODE_ENV } = require('./config/appConfig');
// NODE_ENV and SERVER_BASE_URL are imported for potential use, e.g., logging or conditional logic.
// FRONTEND_URL is imported to be available for future, more specific CORS config.

const connectDB = require('./config/database');
const routes = require('./routes/index');

// Initialize Express app
const app = express();

// CORS Configuration
const allowedOrigins = [
  FRONTEND_URL, // From appConfig, e.g., 'http://localhost:5173'
  // Add other origins if needed, e.g., for 127.0.0.1 or deployed versions
  // Example: If FRONTEND_URL is 'http://localhost:5173', you might also want 'http://127.0.0.1:5173'
  // It's often good to derive this from FRONTEND_URL if it's localhost based
];

if (FRONTEND_URL && FRONTEND_URL.startsWith('http://localhost:')) {
    const port = FRONTEND_URL.split(':')[2];
    allowedOrigins.push(`http://127.0.0.1:${port}`);
} else if (FRONTEND_URL && FRONTEND_URL.startsWith('https://localhost:')) {
    // Though less common for dev, handle https localhost if FRONTEND_URL is set that way
    const port = FRONTEND_URL.split(':')[2];
    allowedOrigins.push(`https://127.0.0.1:${port}`);
}


app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman from app, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Request from origin '${origin}' blocked.`); // Optional: log blocked origins
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Cookie Parser Middleware - No longer needed
// app.use(cookieParser());

// Security Headers
app.use(helmet()); // Apply helmet for various security headers

// Rate Limiting - Apply to all requests or specific routes as needed
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Passport Middleware
app.use(passport.initialize()); // Initialize Passport, but no sessions
// app.use(passport.session()); // No longer needed for JWT auth

// Configure Passport (strategy, serialization, deserialization will be removed from here)
require('./config/passportConfig')(passport);

// Mount the main router
// All routes defined in routes/index.js will be available from the root
// e.g., /auth/login, /profile, /api/data
app.use('/', routes);

// Basic Root Route (Optional - can be removed if all routes are handled by the router)
app.get('/', (req, res) => {
  res.send(`Secure Node.js Server with MVC structure is running on ${SERVER_BASE_URL}! Environment: ${NODE_ENV}`);
});

// Error Handling Middleware (should be the last middleware)
app.use((err, req, res, next) => {
  console.error("================================ ERROR ================================");
  console.error(`Error occurred at: ${new Date().toISOString()}`);
  console.error(`Requested URL: ${req.originalUrl}`);
  console.error(`Request Method: ${req.method}`);
  console.error("Error details:", err.stack || err.message || err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred on the server.',
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined // Optional: for dev
  });
});

// Start the server function
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => { // PORT is now from appConfig
      console.log(`Server running on ${SERVER_BASE_URL}`); // Use SERVER_BASE_URL for logging
      console.log(`Current environment: ${NODE_ENV}`);
    });
  } catch (error) {
    // This catch is if connectDB() itself throws an unhandled rejection before process.exit(1)
    // or if app.listen fails, though connectDB handles its own critical failures by exiting.
    console.error('Failed to start server:', error);
    process.exit(1); // Exit if server cannot start
  }
};

// Call the function to start the server
startServer();
