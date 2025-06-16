// 1. Require necessary modules
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');

// Import user model (in-memory for now)
const { users, findUserById, findUserByUsername } = require('./user');
const LocalStrategy = require('passport-local').Strategy;

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

// 3. Configure Passport Local Strategy
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = findUserByUsername(username);
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// 4. Implement passport.serializeUser
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// 5. Implement passport.deserializeUser
passport.deserializeUser((id, done) => {
  try {
    const user = findUserById(id);
    done(null, user); // Passport handles if user is undefined (not found)
  } catch (err) {
    done(err);
  }
});

// Registration route
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 4a. Check for missing username or password
    if (!username || !password) {
      return res.status(400).send('Username and password are required');
    }

    // 4c. Check if username already exists
    if (findUserByUsername(username)) {
      return res.status(400).send('Username already taken');
    }

    // 4d. Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4e. Create new user object
    const newUser = {
      id: Date.now().toString(), // Simple unique ID
      username: username,
      password: hashedPassword
    };

    // 4f. Add user to the array
    users.push(newUser);

    // 4g. Send success response
    res.status(201).send('User registered successfully');
  } catch (error) {
    // 4h. Handle unexpected errors
    console.error('Error during registration:', error);
    res.status(500).send('Internal server error');
  }
});

// 8. Define a simple root route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// 6. Login route
app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err); }
    if (!user) { return res.status(401).json({ message: info ? info.message : 'Login failed' }); }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      return res.status(200).json({ message: 'Login successful', userId: user.id, username: user.username });
    });
  })(req, res, next);
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'You are not authorized to view this resource. Please log in.' });
}

// 7. Profile and other protected routes
app.get('/profile', isAuthenticated, (req, res) => {
  res.status(200).json({
    message: 'Welcome to your profile!',
    userId: req.user.id,
    username: req.user.username
  });
});

// Logout route
app.post('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        // Still try to send a response, but indicate potential issue
        return res.status(500).json({ message: 'Logout partially failed. Could not destroy session.' });
      }
      // Default cookie name for express-session is 'connect.sid'
      // Ensure your session cookie name matches if you've configured it differently.
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout successful' });
    });
  });
});

app.get('/login-failure', (req, res) => {
  res.status(401).send('Login failed. Please try again.');
});

// New protected route
app.get('/api/data', isAuthenticated, (req, res) => {
  res.status(200).json({
    secretData: 'This is some protected data only for logged-in users.',
    timestamp: Date.now()
  });
});

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
