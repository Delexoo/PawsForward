/** Shared CORS — allow only known site origins (no wildcard). */
export const ALLOWED_ORIGINS = [
  "https://delexoo.github.io",
  "https://joinpawsforward.com",
  "https://www.joinpawsforward.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
];

export function corsHeaders(req: Request): Record<string, string> {
  const origin = String(req.headers.get("Origin") || "").trim();
  const extras = String(Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = [...ALLOWED_ORIGINS, ...extras];
  const match = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}
