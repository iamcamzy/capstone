export type SmsSendResult = { ok: true; skipped: true; reason: string };

export async function sendSmsNotification(): Promise<SmsSendResult> {
  return {
    ok: true,
    skipped: true,
    reason: "No SMS provider is configured yet",
  };
}

