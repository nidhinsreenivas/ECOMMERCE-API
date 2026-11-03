
import {
  createOrder,
  getMyOrders as getMyOrdersService,
  getMyOrderById as getMyOrderByIdService,
  getAllOrders as getAllOrdersService,
  updateOrderStatus as updateOrderStatusService,
} from "./order.service.js";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

// Customer: place a new order
export const placeOrder = async (req, res, next) => {
  try {
    const order = await createOrder(req.user._id, req.body);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Customer: view own orders with pagination and filtering
export const getMyOrders = async (req, res, next) => {
  try {
    const result = await getMyOrdersService(
      req.user._id,
      req.query
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Customer: view one of their own orders
export const getMyOrderById = async (req, res, next) => {
  try {
    const order = await getMyOrderByIdService(
      req.user._id,
      req.params.id
    );

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: view all orders with pagination and filtering
export const getAllOrders = async (req, res, next) => {
  try {
    const result = await getAllOrdersService(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// Admin: update order status
export const updateOrderStatus = async (req, res, next) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      throw createError("Invalid order ID", 400);
    }

    const order = await updateOrderStatusService(
      req.params.id,
      req.body.status
    );

    res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};
