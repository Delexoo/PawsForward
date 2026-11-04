import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "./cors.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

/** Normalize US-centric phones to E.164 (+1…). */
function toE164(raw: string): string | null {
  let d = digitsOnly(raw);
  if (!d) return null;
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length === 10) return `+1${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}

function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  const na = da.length === 11 && da.startsWith("1") ? da.slice(1) : da;
  const nb = db.length === 11 && db.startsWith("1") ? db.slice(1) : db;
  return na === nb || da === db;
}

function siteOrigin(): string {
  return String(Deno.env.get("SITE_ORIGIN") || "https://joinpawsforward.com").replace(/\/$/, "");
}

function qrImageUrl(data: string): string {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=512x512&margin=12&data=" +
    encodeURIComponent(data)
  );
}

async function secret(
  admin: ReturnType<typeof createClient>,
  key: string,
  envName: string
): Promise<string> {
  const fromEnv = String(Deno.env.get(envName) || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const { data, error } = await admin.rpc("app_secret", { p_key: key });
    if (error) throw error;
    return String(data || "").trim();
  } catch {
    return "";
  }
}

async function sendTwilio(opts: {
  sid: string;
  token: string;
  from: string;
  to: string;
  body: string;
  mediaUrl?: string;
}) {
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${opts.sid}/Messages.json`;
  const form = new URLSearchParams();
  form.set("To", opts.to);
  form.set("From", opts.from);
  form.set("Body", opts.body);
  if (opts.mediaUrl) form.append("MediaUrl", opts.mediaUrl);

  const auth = btoa(`${opts.sid}:${opts.token}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(payload?.message || payload?.error || `Twilio ${res.status}`);
    throw new Error(msg);
  }
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  let body: {
    referral_code?: string;
    phone?: string;
    first_name?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON" }, 400);
  }

  const code = String(body.referral_code || "").trim();
  const phoneRaw = String(body.phone || "").trim();
  if (!code || !phoneRaw) {
    return json(req, { error: "referral_code and phone are required" }, 400);
  }

  const to = toE164(phoneRaw);
  if (!to) {
    return json(req, { error: "Enter a valid mobile number for texting." }, 400);
  }

  const admin = adminClient();
  const { data: emp, error: empErr } = await admin
    .from("employees")
    .select("id, first_name, last_name, phone, referral_code, created_at")
    .eq("referral_code", code)
    .maybeSingle();

  if (empErr) {
    console.error(empErr);
    return json(req, { error: "Could not look up promoter." }, 500);
  }
  if (!emp) {
    return json(req, { error: "Unknown referral code." }, 404);
  }
  if (!phonesMatch(emp.phone || "", phoneRaw)) {
    return json(req, { error: "Phone does not match this signup." }, 403);
  }

  // Only auto-welcome brand-new signups (blocks arbitrary re-spam of old codes).
  const created = emp.created_at ? new Date(emp.created_at).getTime() : 0;
  if (!created || Date.now() - created > 15 * 60 * 1000) {
    return json(req, { error: "Welcome text window expired." }, 409);
  }

  const { data: prior } = await admin
    .from("promoter_welcome_sends")
    .select("employee_id")
    .eq("employee_id", emp.id)
    .maybeSingle();
  if (prior) {
    return json(req, { ok: true, already: true });
  }

  const sid = await secret(admin, "twilio_account_sid", "TWILIO_ACCOUNT_SID");
  const token = await secret(admin, "twilio_auth_token", "TWILIO_AUTH_TOKEN");
  const from = await secret(admin, "twilio_from_number", "TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    return json(
      req,
      {
        ok: false,
        skipped: true,
        error: "SMS is not configured yet.",
      },
      503
    );
  }

  const origin = siteOrigin();
  const donateUrl = `${origin}/donate.html?ref=${encodeURIComponent(code)}`;
  const qrPageUrl = `${origin}/qr.html?ref=${encodeURIComponent(code)}`;
  const first = String(body.first_name || emp.first_name || "there").trim() || "there";
  const smsBody =
    `Hi ${first} — you're in at Paws Forward!\n\n` +
    `Your donation link:\n${donateUrl}\n\n` +
    `Your QR (save / share):\n${qrPageUrl}\n\n` +
    `Gifts through either count toward your payout. Reply STOP to opt out.`;

  try {
    await sendTwilio({
      sid,
      token,
      from,
      to,
      body: smsBody,
      mediaUrl: qrImageUrl(donateUrl),
    });
  } catch (err) {
    console.error(err);
    // Retry text-only if MMS rejected
    try {
      await sendTwilio({ sid, token, from, to, body: smsBody });
    } catch (err2) {
      console.error(err2);
      return json(req, { error: String((err2 as Error)?.message || "Could not send text.") }, 502);
    }
  }

  try {
    await admin.from("promoter_welcome_sends").insert({
      employee_id: emp.id,
      channel: "sms",
    });
  } catch (err) {
    console.error("welcome send log failed", err);
  }

  return json(req, { ok: true, sent: true });
});
