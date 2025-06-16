// routes/subscriptionRoutes.js
const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authenticateToken = require('../middleware/authenticateToken'); // JWT authentication middleware

// All routes in this file will be protected by JWT authentication

// @route   POST /create-order (assuming this router is mounted at /api/subscriptions or similar)
// @desc    Placeholder for creating a subscription order
// @access  Private (JWT Authenticated)
router.post(
  '/create-order',
  authenticateToken,
  subscriptionController.createSubscriptionOrder
);

// @route   POST /capture-payment
// @desc    Placeholder for capturing a payment and activating subscription
// @access  Private (JWT Authenticated)
router.post(
  '/capture-payment',
  authenticateToken,
  subscriptionController.captureSubscriptionPayment
);

// @route   GET /status
// @desc    Get current user's subscription status
// @access  Private (JWT Authenticated)
router.get(
  '/status',
  authenticateToken,
  subscriptionController.getSubscriptionStatus
);

module.exports = router;
