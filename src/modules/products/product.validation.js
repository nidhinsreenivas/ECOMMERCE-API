import { z } from "zod";

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must contain at least 2 characters")
    .max(150),

  sku: z
    .string()
    .trim()
    .min(3, "SKU must contain at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, "SKU contains invalid characters"),

  description: z
    .string()
    .trim()
    .min(5, "Description must contain at least 5 characters")
    .max(2000),

  price: z
    .number()
    .finite()
    .positive("Price must be greater than zero"),

  salePrice: z
    .number()
    .finite()
    .positive("Sale price must be greater than zero")
    .optional()
    .nullable(),

  stock: z
    .number()
    .int("Stock must be a whole number")
    .min(0, "Stock cannot be negative"),

  category: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID"),
})
.strict()
.refine(
  (data) => data.salePrice == null || data.salePrice < data.price,
  {
    message: "Sale price must be lower than regular price",
    path: ["salePrice"],
  }
);

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),

  sku: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),

  description: z.string().trim().min(5).max(2000).optional(),

  price: z.number().finite().positive().optional(),

  salePrice: z
    .number()
    .finite()
    .positive()
    .nullable()
    .optional(),

  stock: z.number().int().min(0).optional(),

  category: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),

  isActive: z.boolean().optional(),
})
.strict()
.refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required to update a product"
);