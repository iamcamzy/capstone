#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.TERMUX_SMS_SERVER_TOKEN;
const MAX_BODY_BYTES = 20 * 1024;
const SEND_TIMEOUT_MS = Number(process.env.TERMUX_SMS_SEND_TIMEOUT_MS || 30_000);

if (!TOKEN) {
  console.error("TERMUX_SMS_SERVER_TOKEN is required.");
  process.exit(1);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function bearerToken(req) {
  const authorization = req.headers.authorization;
  const prefix = "Bearer ";
  if (!authorization || !authorization.startsWith(prefix)) return null;
  return authorization.slice(prefix.length);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      if (tooLarge) {
        reject(new Error("Request body is too large"));
        return;
      }

      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    req.on("error", () => {
      if (tooLarge) reject(new Error("Request body is too large"));
      else reject(new Error("Failed to read request body"));
    });
  });
}

function validateSmsPayload(payload) {
  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!to) return { ok: false, error: "`to` is required" };
  if (!message) return { ok: false, error: "`message` is required" };
  if (to.length > 40) return { ok: false, error: "`to` is too long" };
  if (message.length > 1600) return { ok: false, error: "`message` is too long" };

  return { ok: true, to, message };
}

function sendSms(to, message) {
  return new Promise((resolve, reject) => {
    const child = spawn("termux-sms-send", ["-n", to, message], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("termux-sms-send timed out"));
    }, SEND_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `termux-sms-send exited with code ${code}`));
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/send-sms") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  if (bearerToken(req) !== TOKEN) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message });
    return;
  }

  const validation = validateSmsPayload(payload);
  if (!validation.ok) {
    sendJson(res, 400, { ok: false, error: validation.error });
    return;
  }

  try {
    await sendSms(validation.to, validation.message);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Termux SMS server listening on http://0.0.0.0:${PORT}/send-sms`);
});
