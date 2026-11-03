import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";

import {
  listUsers,
  getUserDetails,
  changeUserStatus
} from "./admin.controller.js";

import { updateUserStatusSchema } from "./admin.validation.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, authorize("admin"));

router.get("/users", listUsers);
router.get("/users/:id", getUserDetails);

router.patch(
  "/users/:id/status",
  validate(updateUserStatusSchema),
  changeUserStatus
);

export default router;