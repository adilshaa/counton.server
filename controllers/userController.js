// controllers/userController.js

const getUserProfile = (req, res) => {
  // req.user is populated by Passport after authentication
  // The isAuthenticated middleware should have already run
  res.status(200).json({
    message: 'Welcome to your profile!',
    userId: req.user.id,
    username: req.user.username
    // Add any other user details you want to expose here
  });
};

const getProtectedData = (req, res) => {
  // This is another example of a protected route controller
  res.status(200).json({
    secretData: 'This is some protected data only for logged-in users, accessed via userController.',
    timestamp: Date.now(),
    user: { // Optionally include user details
      id: req.user.id,
      username: req.user.username
    }
  });
};

module.exports = {
  getUserProfile,
  getProtectedData
};
