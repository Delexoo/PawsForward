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

function clientIp(req: Request): string | null {
  const forwarded = String(req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("x-real-ip"),
    ...forwarded,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  for (const raw of candidates) {
    const ip = raw.replace(/^::ffff:/i, "");
    if (!ip) continue;
    if (ip === "127.0.0.1" || ip === "::1") continue;
    if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) continue;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) continue;
    return ip;
  }
  return null;
}

async function lookupGeo(ip: string | null) {
  if (!ip) return { city: null as string | null, region: null as string | null, country: null as string | null };
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`geo ${res.status}`);
    const data = await res.json();
    if (!data?.success) {
      return { city: null, region: null, country: null };
    }
    const city = String(data.city || "").trim() || null;
    const region = String(data.region || data.region_code || "").trim() || null;
    const country =
      String(data.country || data.country_code || "").trim() || null;
    return { city, region, country };
  } catch (err) {
    console.warn("geo lookup failed", err);
    return { city: null, region: null, country: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const referralCode = String(payload?.referral_code || "").trim();
    const employeeId = String(payload?.employee_id || "").trim() || null;
    const path = String(payload?.path || "").trim() || null;
    if (!referralCode && !employeeId) {
      return json(req, { error: "referral_code or employee_id required" }, 400);
    }

    const geo = await lookupGeo(clientIp(req));
    const supabase = adminClient();
    const { error } = await supabase.rpc("record_visit", {
      p_referral_code: referralCode || null,
      p_employee_id: employeeId,
      p_path: path,
      p_city: geo.city,
      p_region: geo.region,
      p_country: geo.country,
    });
    if (error) throw error;

    return json(req, {
      ok: true,
      city: geo.city,
      region: geo.region,
      country: geo.country,
    });
  } catch (err) {
    console.error(err);
    return json(req, { error: (err as Error)?.message || "Could not record visit." }, 500);
  }
});
