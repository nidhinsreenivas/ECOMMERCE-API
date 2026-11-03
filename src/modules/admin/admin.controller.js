import {
  getAllUsers,
  getUserById,
  updateUserStatus
} from "./admin.service.js";

export const listUsers = async (req, res, next) => {
  try {
    const result = await getAllUsers(req.query);

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getUserDetails = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

export const changeUserStatus = async (req, res, next) => {
  try {
    const user = await updateUserStatus(
      req.params.id,
      req.body.isActive,
      req.user._id
    );

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};