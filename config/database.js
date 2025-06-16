// config/database.js
const mongoose = require('mongoose');

// Retrieve MongoDB connection string from environment variables
// Fallback to a local MongoDB instance for development if MONGODB_URI is not set
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/secure_node_app_dev';

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      // Mongoose 6+ no longer requires most of these options as they are default
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
      // useCreateIndex: true, // Not supported
      // useFindAndModify: false // Not supported
    });
    console.log('MongoDB Connected successfully.');

    // Optional: Listen for Mongoose connection events after initial connection
    mongoose.connection.on('error', err => {
      console.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected.');
    });

  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Exit process with failure if initial connection fails
    process.exit(1);
  }
};

module.exports = connectDB;
