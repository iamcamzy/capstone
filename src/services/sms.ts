type SendSmsInput = {
  to: string;
  message: string;
};

export type SmsSendResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

const DEFAULT_TIMEOUT_MS = 10_000;

function envValue(key: keyof ImportMetaEnv): string | undefined {
  return import.meta.env[key];
}

function isEnabled(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseTimeout(value: string | undefined): number {
  if (!value) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

export async function sendSmsNotification(input: SendSmsInput): Promise<SmsSendResult> {
  if (!isEnabled(envValue("SMS_ENABLED"))) {
    return { ok: true, skipped: true, reason: "SMS notifications are disabled" };
  }

  const provider = envValue("SMS_PROVIDER");
  if (provider !== "termux") {
    return { ok: true, skipped: true, reason: "No supported SMS provider is configured" };
  }

  const serverUrl = envValue("TERMUX_SMS_SERVER_URL");
  const token = envValue("TERMUX_SMS_SERVER_TOKEN");
  if (!serverUrl || !token) {
    return { ok: true, skipped: true, reason: "Termux SMS server is not configured" };
  }

  const to = input.to.trim();
  const message = input.message.trim();
  if (!to) return { ok: false, error: "No phone number is saved for this booking" };
  if (!message) return { ok: false, error: "SMS message is empty" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeout(envValue("TERMUX_SMS_TIMEOUT_MS")));

  try {
    const response = await fetch(serverUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ to, message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Termux SMS request failed with ${response.status}${details ? `: ${details}` : ""}`,
      };
    }

    return { ok: true };
  } catch (smsError) {
    const message =
      smsError instanceof Error && smsError.name === "AbortError"
        ? "Termux SMS request timed out"
        : smsError instanceof Error
          ? smsError.message
          : "Termux SMS request failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
