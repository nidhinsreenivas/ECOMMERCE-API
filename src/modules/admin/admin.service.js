
import mongoose from "mongoose";
import User from "../../models/User.js";

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Escape special regex characters in search input
const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// 1. List users with search and pagination
export const getAllUsers = async (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.search?.trim()) {
    const search = escapeRegex(query.search.trim());

    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (["admin", "customer"].includes(query.role)) {
    filter.role = query.role;
  }

  if (query.isActive === "true") filter.isActive = true;
  if (query.isActive === "false") filter.isActive = false;

  const [users, totalUsers] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      currentPage: page,
      limit,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
    },
  };
};

// 2. Get one user by ID
export const getUserById = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError("Invalid user ID", 400);
  }

  const user = await User.findById(userId)
    .select("-password")
    .lean();

  if (!user) {
    throw createError("User not found", 404);
  }

  return user;
};

// 3. Activate or deactivate a user
export const updateUserStatus = async (
  userId,
  isActive,
  currentAdminId
) => {
  if (!mongoose.isValidObjectId(userId)) {
    throw createError("Invalid user ID", 400);
  }

  if (typeof isActive !== "boolean") {
    throw createError("isActive must be a boolean", 400);
  }

  if (
    userId.toString() === currentAdminId.toString() &&
    isActive === false
  ) {
    throw createError("You cannot deactivate your own account", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw createError("User not found", 404);
  }

  // Prevent deactivation of the last active admin
  if (
    user.role === "admin" &&
    user.isActive === true &&
    isActive === false
  ) {
    const activeAdminCount = await User.countDocuments({
      role: "admin",
      isActive: true,
    });

    if (activeAdminCount <= 1) {
      throw createError(
        "Cannot deactivate the last active admin account",
        400
      );
    }
  }

  user.isActive = isActive;
  await user.save();

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
};
