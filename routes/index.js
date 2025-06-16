// routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const subscriptionRoutes = require('./subscriptionRoutes'); // <-- Import new routes
// Add any other route modules here in the future

// Mount auth routes under /auth prefix
router.use('/auth', authRoutes);
// Example: POST /auth/register, POST /auth/login, POST /auth/logout

// Mount user routes.
// If this main router (routes/index.js) is mounted at '/' in server.js:
// - userRoutes' /profile becomes /profile
// - userRoutes' /api/data becomes /api/data
// This seems like a reasonable setup.
router.use('/', userRoutes);

// Mount subscription routes under /api/subscriptions prefix
router.use('/api/subscriptions', subscriptionRoutes); // <-- Mount new routes
// Example: POST /api/subscriptions/create-order

// Future routes for other resources can be added similarly:
// const productRoutes = require('./productRoutes');
// router.use('/products', productRoutes);

module.exports = router;
