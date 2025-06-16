// server.js (Main Application File)
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Import main router
const routes = require('./routes/index'); // This will import routes/index.js
const connectDB = require('./config/database'); // Import connectDB function

// Initialize Express app
const app = express();

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

// Session Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_very_secure_secret_key_change_me', // Change in production and use environment variable
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
    httpOnly: true, // Prevent client-side JS from accessing the cookie
    // sameSite: 'Lax' // Consider adding SameSite attribute for CSRF protection
  }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport (strategy, serialization, deserialization)
require('./config/passportConfig')(passport);

// Mount the main router
// All routes defined in routes/index.js will be available from the root
// e.g., /auth/login, /profile, /api/data
app.use('/', routes);

// Basic Root Route (Optional - can be removed if all routes are handled by the router)
app.get('/', (req, res) => {
  res.send('Secure Node.js Server with MVC structure is running!');
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
    await connectDB(); // Connect to the database

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // console.log('MongoDB connection successful and server listening.'); // connectDB already logs success
      console.log('Registered routes (from server.js perspective, actual routes are in ./routes):');
      console.log('- All application routes are now mounted via ./routes/index.js');
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
