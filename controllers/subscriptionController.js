// controllers/subscriptionController.js
const User = require('../models/userModel');
const { client } = require('../utils/paypalClient'); // Import the configured PayPal client
const {
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_CURRENCY,
  FRONTEND_URL,
  SUBSCRIPTION_PLAN_ID
} = require('../config/appConfig');

const createSubscriptionOrder = async (req, res, next) => {
  try {
    // Create order request body
    const orderRequest = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: SUBSCRIPTION_CURRENCY,
          value: SUBSCRIPTION_PRICE.toString() // Ensure this is a string
        },
        description: 'Monthly Standard Subscription' // Optional but good
      }],
      application_context: {
        brand_name: 'CountOnApp', // Replace with your app's name
        return_url: `${FRONTEND_URL}/payment-success`,
        cancel_url: `${FRONTEND_URL}/payment-cancelled`,
        user_action: 'PAY_NOW' // Or 'SUBSCRIBE_NOW'
      }
    };

    // Use the orders controller from the client
    // The user's code uses client.ordersController.ordersCreate
    // The SDK might actually expose this as client.orders.create e.g.
    // For now, I will trust the user's provided path `client.ordersController.ordersCreate`
    // If this path is incorrect, it will result in a runtime error like "cannot read property 'ordersCreate' of undefined"
    // or "client.ordersController.ordersCreate is not a function".
    // Based on common SDK patterns for @paypal/paypal-server-sdk, it often is client.execute(new OrdersCreateRequest(...))
    // But the user code is king here.
    // The user-provided code for paypalClient.js did NOT export paypal.orders, so this implies
    // the client object itself has these methods or sub-controllers.

    const response = await client.ordersController.ordersCreate({ // Using user-provided structure
      body: orderRequest,
      prefer: 'return=representation' // Added prefer header as it's good practice
    });

    const orderID = response.result.id;

    res.status(201).json({
      message: 'PayPal order created successfully.',
      orderID: orderID
    });

  } catch (error) {
    console.error("PayPal Order Creation Error in Controller:", error); // Log the actual error structure
    let errorMessage = 'Failed to create PayPal order.';
    let statusCode = 500;

    // Updated error handling to be more aligned with potential SDK error structures
    if (error.statusCode) { // This is common for PayPalHttpError
      statusCode = error.statusCode;
      // error.result might not exist if error.message is already the parsed JSON string from PayPal
      // error.message IS OFTEN THE JSON STRING for PayPalHttpError
      try {
          const paypalError = (typeof error.message === 'string' && (error.message.startsWith('{') || error.message.startsWith('[')))
                              ? JSON.parse(error.message)
                              : (error.result || {}); // Fallback to error.result if message isn't JSON

          if (paypalError.details && Array.isArray(paypalError.details) && paypalError.details.length > 0) {
              errorMessage = paypalError.details.map(d => `${d.issue}: ${d.description}`).join('; ');
          } else if (paypalError.message) {
              errorMessage = paypalError.message;
          } else if (typeof error.message === 'string' && !(error.message.startsWith('{') || error.message.startsWith('['))) {
             errorMessage = error.message; // Use raw message if not JSON and no other details found
          }
      } catch (parseErr) {
          // If parsing error.message fails, and error.message is a string, use it directly
          if (typeof error.message === 'string') errorMessage = error.message;
      }
    } else if (error.message) { // Fallback for other error types
      errorMessage = error.message;
    }

    return res.status(statusCode).json({ message: errorMessage });
  }
};

const captureSubscriptionPayment = async (req, res, next) => {
  const { orderID } = req.body;
  const userId = req.user.id;

  if (!orderID) {
    return res.status(400).json({ message: 'PayPal Order ID is required.' });
  }

  try {
    // Use the orders controller from the client to capture the order
    const response = await client.ordersController.ordersCapture({ // Using user-provided structure
      id: orderID, // Make sure this is how the SDK expects the order ID for capture
      body: {}, // Usually empty for capture
      prefer: 'return=representation' // Added prefer header
    });

    if (response.result.status !== 'COMPLETED') {
      return res.status(400).json({
        message: 'Payment capture not completed by PayPal.',
        paypalStatus: response.result.status
      });
    }

    const capture = response.result.purchase_units[0].payments.captures[0];
    const capturedAmount = capture.amount.value;
    const capturedCurrency = capture.amount.currency_code;
    const paypalTransactionId = capture.id;

    if (SUBSCRIPTION_PRICE && capturedAmount !== SUBSCRIPTION_PRICE.toString()) { // Ensure SUBSCRIPTION_PRICE is defined
      console.warn(`Captured amount mismatch for order ${orderID}. Expected ${SUBSCRIPTION_PRICE}, got ${capturedAmount}.`);
    }
    if (SUBSCRIPTION_CURRENCY && capturedCurrency !== SUBSCRIPTION_CURRENCY) { // Ensure SUBSCRIPTION_CURRENCY is defined
      console.warn(`Captured currency mismatch for order ${orderID}. Expected ${SUBSCRIPTION_CURRENCY}, got ${capturedCurrency}.`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    user.subscriptionPlan = SUBSCRIPTION_PLAN_ID;
    user.subscribedAt = now;
    user.expiresAt = new Date(now.getTime() + thirtyDaysInMs);
    user.lastPaymentAmount = parseFloat(capturedAmount);
    user.lastPaymentDate = now;
    user.paymentTransactionId = paypalTransactionId;
    user.subscriptionStatus = 'active';

    await user.save();

    res.status(200).json({
      message: 'Payment captured and subscription activated successfully.',
      subscription: {
        plan: user.subscriptionPlan,
        status: user.subscriptionStatus,
        subscribedAt: user.subscribedAt,
        expiresAt: user.expiresAt,
        lastPaymentAmount: user.lastPaymentAmount,
        paymentTransactionId: user.paymentTransactionId
      }
    });

  } catch (error) {
    console.error("PayPal Payment Capture Error in Controller:", error); // Log the actual error structure
    let errorMessage = 'Failed to capture PayPal payment.';
    let statusCode = 500;

    if (error.statusCode) {
      statusCode = error.statusCode;
      try {
          const paypalError = (typeof error.message === 'string' && (error.message.startsWith('{') || error.message.startsWith('[')))
                              ? JSON.parse(error.message)
                              : (error.result || {});

          if (paypalError.details && Array.isArray(paypalError.details) && paypalError.details.length > 0) {
              errorMessage = paypalError.details.map(d => `${d.issue}: ${d.description}`).join('; ');
          } else if (paypalError.message) {
              errorMessage = paypalError.message;
          } else if (typeof error.message === 'string' && !(error.message.startsWith('{') || error.message.startsWith('['))) {
             errorMessage = error.message;
          }
      } catch (parseErr) {
          if (typeof error.message === 'string') errorMessage = error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return res.status(statusCode).json({ message: errorMessage });
  }
};

const getSubscriptionStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('subscriptionPlan subscribedAt expiresAt subscriptionStatus lastPaymentAmount lastPaymentDate paymentTransactionId');

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
