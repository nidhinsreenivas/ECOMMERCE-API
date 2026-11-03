
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),

  email: z.string()
    .trim()
    .email("Please provide a valid email")
    .transform((value) => value.toLowerCase()),

  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password cannot exceed 72 characters"),

  phone: z.string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Invalid phone number")
    .optional()
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),

  password: z.string()
    .min(1, "Password is required")
});