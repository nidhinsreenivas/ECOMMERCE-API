
import {
  registerUser,
  loginUser
} from "./auth.service.js";

// Register customer
export const register = async (req, res, next) => {
  try {
    const user = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user
    });

  } catch (error) {
    next(error);
  }
};

// Login customer/admin
export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result
    });

  } catch (error) {
    next(error);
  }
};
