// response.ts — consistent JSON response helpers
type SuccessPayload = Record<string, unknown> | unknown[];

export function ok(data: SuccessPayload, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function created(data: SuccessPayload): Response {
  return ok(data, 201);
}

export function error(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Shortcuts kept for back-compat during migration
export const jsonOk      = ok;
export const jsonCreated = created;
export const jsonError   = error;
