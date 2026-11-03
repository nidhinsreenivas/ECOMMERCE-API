import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const orderItemSchema = z
  .object({
    product: objectIdSchema,
    quantity: z.number().int().min(1).max(1000),
  })
  .strict();

const shippingAddressSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(20),
    addressLine: z.string().trim().min(5).max(250),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(3).max(15),
    country: z.string().trim().min(2).max(100),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z.array(orderItemSchema).min(1).max(50),
    shippingAddress: shippingAddressSchema,
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ]),
  })
  .strict();