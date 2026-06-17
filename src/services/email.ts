type SendEmailInput = {
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlContent: string;
  textContent: string;
};

export type EmailSendResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

function envValue(key: keyof ImportMetaEnv): string | undefined {
  return import.meta.env[key];
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<EmailSendResult> {
  const apiKey = envValue("BREVO_API_KEY");
  if (!apiKey) {
    console.warn("[Email] BREVO_API_KEY is missing; email notification skipped.");
    return { ok: true, skipped: true, reason: "BREVO_API_KEY is not configured" };
  }

  const senderName = envValue("BREVO_SENDER_NAME") ?? "Woodberry Resorts and Events Place";
  const senderEmail = envValue("BREVO_SENDER_EMAIL") ?? "wbrepprototype@gmail.com";

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: input.toEmail, name: input.toName ?? undefined }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    return {
      ok: false,
      error: `Brevo email request failed with ${response.status}${details ? `: ${details}` : ""}`,
    };
  }

  return { ok: true };
}

