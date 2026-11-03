
import jwt from "jsonwebtoken";
import User from "../../models/User.js";

// Helper for application errors
const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Register customer
export const registerUser = async (userData) => {
  const { name, password, phone } = userData;
  const email = userData.email.toLowerCase().trim();

  // Check existing email
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw createError("Email already registered", 409);
  }

  // Create customer
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: "customer"
  });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
};

// Login user
export const loginUser = async ({ email, password }) => {

  // Ensure JWT secret exists
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find user with password
  const user = await User.findOne({
    email: normalizedEmail
  }).select("+password");

  if (!user) {
    throw createError("Invalid email or password", 401);
  }

  // Check account status
  if (!user.isActive) {
    throw createError("Your account is deactivated", 403);
  }

  // Compare password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw createError("Invalid email or password", 401);
  }

  // Generate JWT
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      algorithm: "HS256"
    }
  );

  // Return safe user information
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive
    }
  };
};
