import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must contain at least 2 characters")
    .max(80, "Category name cannot exceed 80 characters"),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .default(""),

  parent: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid parent category ID")
    .nullable()
    .optional()
})
.strict();

export const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must contain at least 2 characters")
    .max(80, "Category name cannot exceed 80 characters")
    .optional(),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),

  parent: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid parent category ID")
    .nullable()
    .optional(),

  isActive: z.boolean().optional()
})
.strict()
.refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required for updating a category"
);