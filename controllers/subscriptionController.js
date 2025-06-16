// controllers/subscriptionController.js
const User = require('../models/userModel');

// Placeholder for creating a subscription order (e.g., with PayPal)
const createSubscriptionOrder = async (req, res, next) => {
  try {
    // In a real scenario, you'd interact with PayPal SDK here to create an order.
    // The amount would come from your plan definition.
    const planAmount = 10.00; // Example amount for 'monthly_standard'
    const orderId = 'simulated_paypal_order_id_' + Date.now();

    // For now, just return dummy data.
    res.status(200).json({
      message: 'Simulated order created successfully (placeholder).',
      orderId: orderId,
      plan: 'monthly_standard',
      amount: planAmount
    });
  } catch (error) {
    next(error);
  }
};

// Placeholder for capturing a subscription payment (e.g., after PayPal approval)
const captureSubscriptionPayment = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming JWT middleware populates req.user
    // In a real scenario, you'd get transactionId, amount etc. from PayPal's capture response.
    // const { orderIdFromClient, paypalActualTransactionId, actualAmountPaid } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    user.subscriptionPlan = 'monthly_standard';
    user.subscribedAt = now;
    user.expiresAt = new Date(now.getTime() + thirtyDaysInMs);
    user.lastPaymentAmount = 10.00; // Placeholder fixed amount
    user.lastPaymentDate = now;
    user.paymentTransactionId = 'simulated_paypal_tx_id_' + Date.now(); // Placeholder
    user.subscriptionStatus = 'active';

    await user.save();

    res.status(200).json({
      message: 'Subscription activated successfully (placeholder).',
      subscription: {
        plan: user.subscriptionPlan,
        subscribedAt: user.subscribedAt,
        expiresAt: user.expiresAt,
        status: user.subscriptionStatus,
        lastPaymentAmount: user.lastPaymentAmount,
        lastPaymentDate: user.lastPaymentDate,
        paymentTransactionId: user.paymentTransactionId
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(' ') });
    }
    next(error);
  }
};

// Get current user's subscription status
const getSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('subscriptionPlan subscribedAt expiresAt subscriptionStatus lastPaymentAmount lastPaymentDate paymentTransactionId'); // Select only relevant fields

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      plan: user.subscriptionPlan,
      status: user.subscriptionStatus,
      subscribedAt: user.subscribedAt,
      expiresAt: user.expiresAt,
      lastPaymentAmount: user.lastPaymentAmount,
      lastPaymentDate: user.lastPaymentDate,
      paymentTransactionId: user.paymentTransactionId
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubscriptionOrder,
  captureSubscriptionPayment,
  getSubscriptionStatus
};
