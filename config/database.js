// config/database.js
const mongoose = require('mongoose');
const { MONGODB_URI } = require('./appConfig'); // Import MONGODB_URI from central config

const connectDB = async () => {
  try {
    // MONGODB_URI is now sourced from appConfig, which includes the default 'counton_db'
    await mongoose.connect(MONGODB_URI, {
      // Mongoose 6+ no longer requires most of these options as they are default
    });
    console.log(`MongoDB Connected successfully to: ${mongoose.connection.name}`); // Log the actual DB name

    mongoose.connection.on('error', err => {
      console.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected.');
    });

  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
