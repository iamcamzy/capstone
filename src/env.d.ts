/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly BREVO_API_KEY?: string;
  readonly BREVO_SENDER_NAME?: string;
  readonly BREVO_SENDER_EMAIL?: string;
  readonly NOTIFICATION_CRON_SECRET?: string;
  readonly SMS_ENABLED?: string;
  readonly SMS_PROVIDER?: string;
  readonly TERMUX_SMS_SERVER_URL?: string;
  readonly TERMUX_SMS_SERVER_TOKEN?: string;
  readonly TERMUX_SMS_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
