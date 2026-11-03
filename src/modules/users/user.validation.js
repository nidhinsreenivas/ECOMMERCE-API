import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters")
    .optional(),

  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Phone must contain 10 to 15 digits")
    .optional()
})
.strict()
.refine(
  (data) => Object.keys(data).length > 0,
  "Please provide at least one field to update"
);