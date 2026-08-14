import { z } from "zod";

export const signInSchema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required").max(128, "Password too long"),
});

export const signUpSchema = z.object({
  email:     z.string().email("Invalid email"),
  password:  z.string()
               .min(6, "Password must be at least 6 characters")
               .max(128, "Password must be at most 128 characters"),
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type SignInInput  = z.infer<typeof signInSchema>;
export type SignUpInput  = z.infer<typeof signUpSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
