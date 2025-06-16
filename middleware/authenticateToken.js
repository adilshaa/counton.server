// middleware/authenticateToken.js
const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/userModel'); // To potentially fetch full user object

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Token is expected to be in the format: "Bearer TOKEN_STRING"
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    // No token provided
    return res.status(401).json({ message: 'Unauthorized: Access token is required.' });
  }

  const decodedPayload = verifyAccessToken(token);

  if (!decodedPayload) {
    // Token is invalid (e.g., expired, malformed, incorrect signature)
    return res.status(403).json({ message: 'Forbidden: Invalid or expired access token.' });
  }

  try {
    // The payload should contain user identifiers, e.g., id.
    // We can attach the raw payload or fetch the full user object.
    // Fetching the full user object ensures it's current and not from a stale token payload
    // if user details changed since token issuance (though access tokens are short-lived).
    // For simplicity, we can start by attaching the decoded payload.
    // For more robustness, fetching the user from DB is better.

    // Option 1: Attach decoded payload directly (simpler, less DB load)
    // req.user = decodedPayload;

    // Option 2: Fetch user from DB (more robust, ensures user still exists and is active)
    const user = await User.findById(decodedPayload.id).select('-password'); // Exclude password
    if (!user) {
      return res.status(403).json({ message: 'Forbidden: User not found for token.' });
    }
    req.user = user; // Attach the Mongoose user document (without password)

    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    // console.error("Error in authenticateToken middleware while fetching user:", error);
    // This could happen if User.findById fails for some reason other than 'not found'
    return res.status(500).json({ message: 'Internal server error during token authentication.' });
  }
};

module.exports = authenticateToken;
