// controllers/subscriptionController.js
const User = require('../models/userModel');
const paypal = require('@paypal/paypal-server-sdk'); // Import the core SDK
const { client } = require('../utils/paypalClient'); // Import the configured PayPal client
const {
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_CURRENCY,
  SUBSCRIPTION_PLAN_ID, // Ensure this is imported
  SERVER_BASE_URL, // For example return/cancel URLs
  FRONTEND_URL // A more likely candidate for return/cancel URLs
} = require('../config/appConfig');

const createSubscriptionOrder = async (req, res, next) => {
  try {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation"); // Get full response, not just status
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: SUBSCRIPTION_CURRENCY,
          value: SUBSCRIPTION_PRICE // Ensure this is a string as per PayPal docs
        },
        // description: 'Monthly Standard Subscription' // Optional
      }],
      application_context: {
        brand_name: 'CountOnApp', // Replace with your app's name
        // landing_page: 'LOGIN', // Or 'BILLING'
        // These URLs are often handled by the client-side SDK that opens the PayPal window,
        // but can be specified. They might be where PayPal redirects after payment.
        return_url: `${FRONTEND_URL}/payment-success`, // Example URL
        cancel_url: `${FRONTEND_URL}/payment-cancelled`, // Example URL
        // user_action: 'SUBSCRIBE_NOW' // Or 'PAY_NOW'
      }
    });

    const response = await client.execute(request);
    // The response.result object contains the PayPal order details, including the ID.
    const orderID = response.result.id;

    res.status(201).json({ // 201 Created for new resource (the order)
      message: 'PayPal order created successfully.',
      orderID: orderID,
      // Optionally send back the full response.result or selected parts if client needs them
      // paypalOrderDetails: response.result
    });

  } catch (error) {
    // console.error("PayPal Order Creation Error:", error);
    // Check if it's a PayPalHttpError for more details
    if (error.isAxiosError && error.response) { // AxiosError is typical for paypal-server-sdk v1
        // console.error("PayPal API Error Details:", error.response.data);
        // For paypal-server-sdk, error might be an instance of paypal.core.PayPalHttpError
        // which has a statusCode and message (often JSON string in error.message)
        let errorMessage = 'Failed to create PayPal order.';
        if (error.statusCode && error.message) {
            try {
                const paypalError = JSON.parse(error.message);
                errorMessage = paypalError.details && paypalError.details.length > 0
                               ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                               : paypalError.message || errorMessage;
            } catch (parseErr) {
                // If error.message is not JSON, use it directly or fallback
                errorMessage = error.message || errorMessage;
            }
            return res.status(error.statusCode || 500).json({ message: errorMessage });
        }
         return res.status(500).json({ message: 'Failed to create PayPal order due to API error.'});
    } else if (error instanceof paypal.core.PayPalHttpError) { // For newer SDKs if they use this error type
        let errorMessage = 'Failed to create PayPal order.';
        try {
            const details = JSON.parse(error.message); // error.message often contains JSON details
            if (details && details.details && Array.isArray(details.details) && details.details.length > 0) {
                errorMessage = details.details.map(d => `${d.issue}: ${d.description}`).join('; ');
            } else if (details && details.message) {
                errorMessage = details.message;
            }
        } catch (e) {
            // fallback if error.message is not JSON
        }
        return res.status(error.statusCode || 500).json({ message: errorMessage });
    }
    // Fallback for other types of errors
    next(error);
  }
};

const captureSubscriptionPayment = async (req, res, next) => {
  const { orderID } = req.body; // orderID comes from the client after PayPal JS SDK approval
  const userId = req.user.id;   // From JWT authentication

  if (!orderID) {
    return res.status(400).json({ message: 'PayPal Order ID is required.' });
  }

  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({}); // Empty body for capture after approval

    const response = await client.execute(request);
    // response.result contains the capture details

    // Check if the capture was successful
    if (response.result.status !== 'COMPLETED') {
      // This might happen if, for example, the payment method failed after approval.
      // PayPal's API might return different statuses, 'COMPLETED' is typical for successful capture.
      return res.status(400).json({
        message: 'Payment capture not completed by PayPal.',
        paypalStatus: response.result.status
      });
    }

    // Extract relevant details from the PayPal capture response
    const capture = response.result.purchase_units[0].payments.captures[0];
    const capturedAmount = capture.amount.value;
    const capturedCurrency = capture.amount.currency_code;
    const paypalTransactionId = capture.id; // This is the PayPal transaction ID for the capture

    // Verify amount and currency if necessary (e.g., against SUBSCRIPTION_PRICE, SUBSCRIPTION_CURRENCY)
    if (capturedAmount !== SUBSCRIPTION_PRICE || capturedCurrency !== SUBSCRIPTION_CURRENCY) {
        // Log this discrepancy for investigation - it might indicate an issue or unexpected scenario
        console.warn(`Captured amount/currency mismatch for order ${orderID}. Expected ${SUBSCRIPTION_PRICE} ${SUBSCRIPTION_CURRENCY}, got ${capturedAmount} ${capturedCurrency}. Proceeding with captured values.`);
        // Decide on business logic: reject, or accept and log. For now, we'll log and proceed.
    }

    const user = await User.findById(userId);
    if (!user) {
      // This should ideally not happen if JWT is valid, but good to check.
      return res.status(404).json({ message: 'User not found.' });
    }

    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const now = new Date();

    user.subscriptionPlan = SUBSCRIPTION_PLAN_ID; // Use plan ID from appConfig
    user.subscribedAt = now;
    user.expiresAt = new Date(now.getTime() + thirtyDaysInMs);
    user.lastPaymentAmount = parseFloat(capturedAmount); // Use actual captured amount
    user.lastPaymentDate = now; // Could also use capture.create_time from PayPal if preferred
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
      },
      // paypalCaptureDetails: capture // Optionally return capture details
    });

  } catch (error) {
    // console.error("PayPal Payment Capture Error:", error);
    if (error.isAxiosError && error.response) { // Or PayPalHttpError logic similar to createOrder
        let errorMessage = 'Failed to capture PayPal payment.';
         if (error.statusCode && error.message) {
            try {
                const paypalError = JSON.parse(error.message);
                errorMessage = paypalError.details && paypalError.details.length > 0
                               ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                               : paypalError.message || errorMessage;
            } catch (parseErr) {
                errorMessage = error.message || errorMessage;
            }
            return res.status(error.statusCode || 500).json({ message: errorMessage });
        }
        return res.status(500).json({ message: 'Failed to capture PayPal payment due to API error.'});
    } else if (error instanceof paypal.core.PayPalHttpError) {
        let errorMessage = 'Failed to capture PayPal payment.';
        try {
            const details = JSON.parse(error.message);
            if (details && details.details && Array.isArray(details.details) && details.details.length > 0) {
                errorMessage = details.details.map(d => `${d.issue}: ${d.description}`).join('; ');
            } else if (details && details.message) {
                errorMessage = details.message;
            }
        } catch (e) { /* fallback */ }
        return res.status(error.statusCode || 500).json({ message: errorMessage });
    }
    next(error); // Fallback for other errors (e.g., DB save error)
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
