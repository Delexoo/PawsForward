import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "./cors.ts";

/** v2 = open amount field (no $25 preset). Older prices kept the preset baked in. */
const DONATE_PRICE_META = "pawsforward_donate_custom_v2";
const DONATE_PRICE_META_LEGACY = "pawsforward_donate_custom";

let _req: Request | null = null;

function json(body: unknown, status = 200) {
  const cors = _req ? corsHeaders(_req) : corsHeaders(new Request("https://delexoo.github.io"));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function stripeSecret(supabase: ReturnType<typeof adminClient>) {
  const envKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (envKey) return envKey;
  const { data, error } = await supabase.rpc("app_secret", { p_key: "stripe_secret_key" });
  if (error) throw error;
  return data as string | null;
}

/** Reusable pay-what-you-want Price (custom_unit_amount is not valid on Checkout price_data). */
async function ensureCustomDonatePrice(stripe: Stripe) {
  const listed = await stripe.prices.list({ active: true, limit: 100 });
  const existing = listed.data.find((p) => p.metadata?.[DONATE_PRICE_META] === "1");
  if (existing?.id) return existing.id;

  const legacy = listed.data.filter((p) => p.metadata?.[DONATE_PRICE_META_LEGACY] === "1");
  let productId: string | null = null;
  for (const old of legacy) {
    if (typeof old.product === "string" && !productId) productId = old.product;
    try {
      await stripe.prices.update(old.id, { active: false });
    } catch (err) {
      console.warn("Could not archive legacy donate price", old.id, err);
    }
  }

  if (!productId) {
    const products = await stripe.products.list({ active: true, limit: 50 });
    productId =
      products.data.find((p) => p.metadata?.pawsforward === "donate")?.id ||
      (
        await stripe.products.create({
          name: "PawsForward donation",
          metadata: { pawsforward: "donate" },
        })
      ).id;
  }

  const price = await stripe.prices.create({
    currency: "usd",
    product: productId,
    custom_unit_amount: {
      enabled: true,
      minimum: 100,
      // No preset — donor types any amount ($1+).
    },
    metadata: { [DONATE_PRICE_META]: "1" },
  });
  return price.id;
}

async function buildCheckout(input: {
  amount?: number | null;
  customAmount?: boolean;
  referralCode: string;
  donorLabel?: string;
  siteOrigin: string;
}) {
  const supabase = adminClient();
  const stripeKey = await stripeSecret(supabase);
  if (!stripeKey) throw new Error("Stripe is not configured.");

  const referralCode = String(input.referralCode || "").trim();
  let emp: { id?: string; first_name?: string; last_name?: string } | null = null;

  if (referralCode) {
    const { data: empRows, error: empErr } = await supabase.rpc("resolve_employee_by_code", {
      p_code: referralCode,
    });
    if (empErr) throw empErr;
    emp = Array.isArray(empRows) ? empRows[0] : empRows;
    if (!emp?.id) {
      const err = new Error("This QR code is not linked to an employee.");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }
  }

  const useCustom = input.customAmount !== false && !(Number(input.amount) > 0);
  const amount = Number(input.amount);
  if (!useCustom && (!Number.isFinite(amount) || amount < 1)) {
    throw new Error("Enter at least $1.");
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const employeeName = emp
    ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "PawsForward"
    : "PawsForward";
  const donorLabel = String(input.donorLabel || "").trim();
  const siteOrigin = input.siteOrigin.replace(/\/$/, "");
  const source = referralCode ? "employee_qr" : "direct";

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = { quantity: 1 };
  if (useCustom) {
    lineItem.price = await ensureCustomDonatePrice(stripe);
  } else {
    lineItem.price_data = {
      currency: "usd",
      unit_amount: Math.round(amount * 100),
      product_data: {
        name: "PawsForward donation",
        description: referralCode
          ? `Donation attributed to ${employeeName}`
          : "Direct donation to PawsForward",
      },
    };
  }

  const successUrl = referralCode
    ? `${siteOrigin}/donate.html?ref=${encodeURIComponent(referralCode)}&success=1&session_id={CHECKOUT_SESSION_ID}`
    : `${siteOrigin}/donate.html?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = referralCode
    ? `${siteOrigin}/donate.html?ref=${encodeURIComponent(referralCode)}&cancelled=1`
    : `${siteOrigin}/donate.html?cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    client_reference_id: (referralCode || "direct").slice(0, 200),
    line_items: [lineItem],
    metadata: {
      referral_code: referralCode,
      employee_id: emp?.id ? String(emp.id) : "",
      donor_label: donorLabel || "",
      source,
    },
    payment_intent_data: {
      description: referralCode
        ? `PawsForward donation · ${employeeName}`
        : "PawsForward direct donation",
      metadata: {
        referral_code: referralCode,
        employee_id: emp?.id ? String(emp.id) : "",
        donor_label: donorLabel || "",
        source,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, session_id: session.id, employee: emp };
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
    if (!data?.success) return { city: null, region: null, country: null };
    return {
      city: String(data.city || "").trim() || null,
      region: String(data.region || data.region_code || "").trim() || null,
      country: String(data.country || data.country_code || "").trim() || null,
    };
  } catch (err) {
    console.warn("geo lookup failed", err);
    return { city: null, region: null, country: null };
  }
}

async function recordQrVisit(req: Request, referralCode: string, employeeId: string | null) {
  try {
    const geo = await lookupGeo(clientIp(req));
    const supabase = adminClient();
    await supabase.rpc("record_visit", {
      p_referral_code: referralCode,
      p_employee_id: employeeId,
      p_path: `/functions/v1/create-checkout?ref=${encodeURIComponent(referralCode)}`,
      p_city: geo.city,
      p_region: geo.region,
      p_country: geo.country,
    });
  } catch (err) {
    console.warn("record_visit failed", err);
  }
}

Deno.serve(async (req) => {
  _req = req;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const siteDefault =
      Deno.env.get("SITE_ORIGIN") || "https://delexoo.github.io/PawsForward";

    if (req.method === "GET") {
      const url = new URL(req.url);
      const referralCode = String(url.searchParams.get("ref") || "").trim();
      if (!referralCode) {
        // Direct donate from landing — open Stripe without an employee attribution.
        const result = await buildCheckout({
          customAmount: true,
          referralCode: "",
          siteOrigin: siteDefault,
        });
        if (!result.url) return json({ error: "No checkout URL." }, 500);
        return Response.redirect(result.url, 303);
      }
      const result = await buildCheckout({
        customAmount: true,
        referralCode,
        siteOrigin: siteDefault,
      });
      if (!result.url) return json({ error: "No checkout URL." }, 500);
      await recordQrVisit(req, referralCode, result.employee?.id ? String(result.employee.id) : null);
      return Response.redirect(result.url, 303);
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const payload = await req.json();
    const result = await buildCheckout({
      amount: payload?.amount,
      customAmount: payload?.custom_amount !== false,
      referralCode: String(payload?.referral_code || ""),
      donorLabel: String(payload?.donor_label || ""),
      siteOrigin: String(payload?.site_origin || siteDefault),
    });
    return json(result);
  } catch (err) {
    console.error(err);
    const status = Number((err as { status?: number })?.status) || 500;
    return json({ error: err?.message || "Could not start checkout." }, status);
  }
});
