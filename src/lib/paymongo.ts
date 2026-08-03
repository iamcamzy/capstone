const PAYMONGO_SECRET_KEY = import.meta.env.PAYMONGO_SECRET_KEY;
const API_BASE = "https://api.paymongo.com";

function authHeader() {
  if (!PAYMONGO_SECRET_KEY) throw new Error("PAYMONGO_SECRET_KEY is not configured");
  return `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString("base64")}`;
}

export async function paymongoRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.message ?? "PayMongo request failed";
    throw new Error(detail);
  }
  return json;
}

export function pesoToCentavos(amount: number) {
  return Math.round(amount * 100);
}
