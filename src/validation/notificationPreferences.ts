import { z } from "zod";

export const notificationPreferencesSchema = z
  .object({
    emailNotificationsEnabled: z.boolean(),
    smsNotificationsEnabled: z.boolean(),
  })
  .refine((value) => value.emailNotificationsEnabled || value.smsNotificationsEnabled, {
    message: "At least one notification channel must remain enabled",
  });

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;

