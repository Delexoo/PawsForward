import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
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
  if (!referralCode) throw new Error("Missing employee referral code.");

  const { data: empRows, error: empErr } = await supabase.rpc("resolve_employee_by_code", {
    p_code: referralCode,
  });
  if (empErr) throw empErr;
  const emp = Array.isArray(empRows) ? empRows[0] : empRows;
  if (!emp?.id) {
    const err = new Error("This QR code is not linked to an employee.");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const useCustom = input.customAmount !== false && !(Number(input.amount) > 0);
  const amount = Number(input.amount);
  if (!useCustom && (!Number.isFinite(amount) || amount < 1)) {
    throw new Error("Enter at least $1.");
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const employeeName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "PawsForward";
  const donorLabel = String(input.donorLabel || "").trim();
  const siteOrigin = input.siteOrigin.replace(/\/$/, "");

  const priceData: Record<string, unknown> = {
    currency: "usd",
    product_data: {
      name: "PawsForward donation",
      description: `Donation attributed to ${employeeName}`,
    },
  };

  if (useCustom) {
    priceData.custom_unit_amount = {
      enabled: true,
      minimum: 100,
      preset: 2500,
    };
  } else {
    priceData.unit_amount = Math.round(amount * 100);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    submit_type: "donate",
    client_reference_id: referralCode.slice(0, 200),
    line_items: [
      {
        quantity: 1,
        price_data: priceData as Stripe.Checkout.SessionCreateParams.LineItem.PriceData,
      },
    ],
    metadata: {
      referral_code: referralCode,
      employee_id: String(emp.id),
      donor_label: donorLabel || "",
      source: "employee_qr",
    },
    payment_intent_data: {
      metadata: {
        referral_code: referralCode,
        employee_id: String(emp.id),
        donor_label: donorLabel || "",
        source: "employee_qr",
      },
    },
    success_url: `${siteOrigin}/donate.html?ref=${encodeURIComponent(referralCode)}&success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteOrigin}/donate.html?ref=${encodeURIComponent(referralCode)}&cancelled=1`,
  });

  return { url: session.url, session_id: session.id, employee: emp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const siteDefault =
      Deno.env.get("SITE_ORIGIN") || "https://delexoo.github.io/PawsForward";

    if (req.method === "GET") {
      const url = new URL(req.url);
      const referralCode = String(url.searchParams.get("ref") || "").trim();
      const result = await buildCheckout({
        customAmount: true,
        referralCode,
        siteOrigin: siteDefault,
      });
      if (!result.url) return json({ error: "No checkout URL." }, 500);
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
