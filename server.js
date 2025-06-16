// 1. Require necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');

// User model will be imported in controllers/authController.js

// 2. Initialize an Express application
const app = express();

// 3. Configure Helmet
app.use(helmet());

// 4. Configure body-parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 5. Configure express-session
app.use(session({
  secret: 'your secret key', // Replace with a strong secret key in a real application
  resave: false,
  saveUninitialized: false,
  cookie: {
    // secure: true, // Uncomment this line if running on HTTPS
    // Note: `secure: true` requires an HTTPS connection.
    // For development without HTTPS, this should be commented out or set to false.
  }
}));

// 6. Configure rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiter to all requests
app.use(limiter);

// 7. Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport
require('./config/passportConfig')(passport);

// Auth routes are now in routes/authRoutes.js

// 8. Define a simple root route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// isAuthenticated middleware is now in middleware/authMiddleware.js
// It will be imported and used by route files or controllers directly.

// User-specific routes (like /profile, /api/data) are now in routes/userRoutes.js (or similar)
// The /login-failure route is removed as login flow provides JSON responses.

// 9. Set up the server to listen on a port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Error handling middleware (should be the last middleware)
app.use((err, req, res, next) => {
  console.error("================================ ERROR ================================");
  console.error(`Error occurred at: ${new Date().toISOString()}`);
  console.error(`Requested URL: ${req.originalUrl}`);
  console.error(`Request Method: ${req.method}`);
  console.error("Error details:", err.stack || err.message || err); // Log stack trace or message

  // Avoid sending stack trace to client in production
  // For now, we send a generic message
  if (res.headersSent) {
    return next(err); // If headers already sent, delegate to default Express error handler
  }

  res.status(err.status || 500).json({
    message: err.message || 'An unexpected error occurred on the server.',
    // In a development environment, you might want to include err.stack
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});
