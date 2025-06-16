// controllers/subscriptionController.js
const User = require('../models/userModel');
// Import the specific request objects from the SDK's 'orders' submodule
const { OrdersCreateRequest, OrdersCaptureRequest } = require('@paypal/paypal-server-sdk/orders');
const { client } = require('../utils/paypalClient'); // Import the configured PayPal client
const {
  SUBSCRIPTION_PRICE,
  SUBSCRIPTION_CURRENCY,
  FRONTEND_URL, // Was SERVER_BASE_URL, FRONTEND_URL is better for these PayPal URLs
  SUBSCRIPTION_PLAN_ID // Added in a previous step to appConfig
} = require('../config/appConfig');

const createSubscriptionOrder = async (req, res, next) => {
  try {
    // Use the imported request class
    const request = new OrdersCreateRequest();
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
    // Error handling as previously implemented (checking for PayPalHttpError or AxiosError)
    // console.error("PayPal Order Creation Error:", error);
    let errorMessage = 'Failed to create PayPal order.';
    let statusCode = 500;

    if (error.statusCode) { // PayPalHttpError often has statusCode
        statusCode = error.statusCode;
        try {
            const paypalError = JSON.parse(error.message);
            errorMessage = (paypalError.details && paypalError.details.length > 0
                           ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                           : paypalError.message) || errorMessage;
        } catch (parseErr) {
            errorMessage = error.message || errorMessage; // Use raw message if not JSON
        }
    } else if (error.isAxiosError && error.response && error.response.data) { // Deprecated SDK might use Axios
        statusCode = error.response.status;
        const paypalError = error.response.data;
        errorMessage = (paypalError.details && paypalError.details.length > 0
                       ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                       : paypalError.message) || errorMessage;
    } else if (error.message) {
        errorMessage = error.message;
    }

    return res.status(statusCode).json({ message: errorMessage });
  }
};

const captureSubscriptionPayment = async (req, res, next) => {
  const { orderID } = req.body; // orderID comes from the client after PayPal JS SDK approval
  const userId = req.user.id;   // From JWT authentication

  if (!orderID) {
    return res.status(400).json({ message: 'PayPal Order ID is required.' });
  }

  try {
    // Use the imported request class
    const request = new OrdersCaptureRequest(orderID);
    request.requestBody({});

    // Use the client from paypalClient.js
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
    // Error handling as previously implemented
    // console.error("PayPal Payment Capture Error:", error);
    let errorMessage = 'Failed to capture PayPal payment.';
    let statusCode = 500;

    if (error.statusCode) { // PayPalHttpError
        statusCode = error.statusCode;
        try {
            const paypalError = JSON.parse(error.message);
            errorMessage = (paypalError.details && paypalError.details.length > 0
                           ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                           : paypalError.message) || errorMessage;
        } catch (parseErr) {
            errorMessage = error.message || errorMessage;
        }
    } else if (error.isAxiosError && error.response && error.response.data) { // Deprecated SDK
        statusCode = error.response.status;
        const paypalError = error.response.data;
        errorMessage = (paypalError.details && paypalError.details.length > 0
                       ? paypalError.details.map(d => d.issue + ': ' + d.description).join('; ')
                       : paypalError.message) || errorMessage;
    } else if (error.message) {
        errorMessage = error.message;
    }

    return res.status(statusCode).json({ message: errorMessage });
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
