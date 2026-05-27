import { z } from "zod";

/**
 * POST /api/auth/signin  (form data)
 *   email, password
 *
 * POST /api/auth/signup  (JSON body)
 *   email, password, firstName?, lastName?
 */
export const signInSchema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  email:     z.string().email("Invalid email"),
  password:  z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
});

export type SignInInput  = z.infer<typeof signInSchema>;
export type SignUpInput  = z.infer<typeof signUpSchema>;
