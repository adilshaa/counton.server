// models/userModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required.'],
    unique: true,
    trim: true, // Removes whitespace from both ends of a string
    lowercase: true // Converts username to lowercase
  },
  password: {
    type: String,
    required: [true, 'Password is required.'],
    minlength: [6, 'Password must be at least 6 characters long.'] // Example validation
  },
  // You can add more fields here, e.g., email, createdAt, etc.
  createdAt: {
    type: Date,
    default: Date.now
  },
  // New fields:
  lastLoginAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscriptionPlan: {
    type: String,
    enum: ['none', 'monthly_standard'],
    default: 'none'
  },
  subscribedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  lastPaymentAmount: {
    type: Number
  },
  lastPaymentDate: {
    type: Date
  },
  paymentTransactionId: {
    type: String
  },
  subscriptionStatus: {
    type: String,
    enum: ['none', 'active', 'expired', 'cancelled', 'pending_payment'],
    default: 'none'
  },
  currentRefreshToken: {
    type: String,
    select: false // Not included in query results by default
  },
  currentRefreshTokenExpiresAt: {
    type: Date,
    select: false // Not included in query results by default
  }
});

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10); // Generate a salt
    this.password = await bcrypt.hash(this.password, salt); // Hash the password
    next();
  } catch (error) {
    next(error); // Pass errors to the next middleware
  }
});

// Method to compare candidate password with the hashed password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error; // Or handle error appropriately
  }
};

// The collection name will be 'users' (pluralized and lowercased version of 'User')
const User = mongoose.model('User', UserSchema);

module.exports = User;
