import {
  getUserProfile,
  updateUserProfile
} from "./user.service.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await getUserProfile(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const user = await updateUserProfile(req.user._id, req.body);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};