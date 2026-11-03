import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { updateProfileSchema } from "./user.validation.js";
import {
  getProfile,
  updateProfile
} from "./user.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/profile", getProfile);
router.put("/profile", validate(updateProfileSchema), updateProfile);

export default router;