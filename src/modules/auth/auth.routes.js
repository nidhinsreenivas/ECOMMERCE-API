
import express from "express";

import {
  register,
  login
} from "./auth.controller.js";

import {
  registerSchema,
  loginSchema
} from "./auth.validation.js";

import { validate } from "../../middleware/validate.js";

const router = express.Router();

// Customer registration
router.post(
  "/register",
  validate(registerSchema),
  register
);

// Customer/Admin login
router.post(
  "/login",
  validate(loginSchema),
  login
);

export default router;
