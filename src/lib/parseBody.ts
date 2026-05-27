// parseBody.ts — safely parses JSON request body
import { error } from "./response";

export async function parseBody<T = unknown>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  try {
    const data = (await request.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, response: error("Invalid or missing JSON body", 400) };
  }
}
