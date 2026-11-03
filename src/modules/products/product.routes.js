import express from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";

import {
  addProduct,
  listProducts,
  getProductDetails,
  editProduct,
  removeProduct
} from "./product.controller.js";

import {
  createProductSchema,
  updateProductSchema
} from "./product.validation.js";

const router = express.Router();

// Public product browsing
router.get("/", listProducts);
router.get("/:id", getProductDetails);

// Admin-only product management
router.use(authenticate, authorize("admin"));

router.post("/", validate(createProductSchema), addProduct);

router.patch(
  "/:id",
  validate(updateProductSchema),
  editProduct
);

router.delete("/:id", removeProduct);

export default router;