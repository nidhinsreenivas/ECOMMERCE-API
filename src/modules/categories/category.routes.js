import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { listCategoryTree } from "./category.controller.js";

import {
  addCategory,
  listCategories,
  getCategoryDetails,
  editCategory,
  removeCategory
} from "./category.controller.js";

import {
  createCategorySchema,
  updateCategorySchema
} from "./category.validation.js";

const router = express.Router();

// Public endpoint: view categories
router.get("/", listCategories);
router.get("/tree", listCategoryTree);
router.get("/:id", getCategoryDetails);

// Admin-only endpoints
router.use(authenticate, authorize("admin"));

router.post("/", validate(createCategorySchema), addCategory);

router.patch(
  "/:id",
  validate(updateCategorySchema),
  editCategory
);

router.delete("/:id", removeCategory);

export default router;