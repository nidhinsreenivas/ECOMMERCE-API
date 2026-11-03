import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";

import {
  placeOrder,
  getMyOrders,
  getMyOrderById,
  getAllOrders,
  updateOrderStatus,
} from "./order.controller.js";

import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "./order.validation.js";

const router = express.Router();

// All order routes require authentication.
router.use(authenticate);

// Customer routes
router.post(
  "/",
  validate(createOrderSchema),
  placeOrder
);

router.get("/my-orders", getMyOrders);
router.get("/my-orders/:id", getMyOrderById);

// Admin routes
router.get(
  "/",
  authorize("admin"),
  getAllOrders
);

router.patch(
  "/:id/status",
  authorize("admin"),
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

export default router;