import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = adminClient();
    const stripeKey = await stripeSecret(supabase);
    if (!stripeKey) return json({ error: "Stripe is not configured." }, 500);

    const payload = await req.json();
    const amount = Number(payload?.amount);
    const referralCode = String(payload?.referral_code || "").trim();
    const donorLabel = String(payload?.donor_label || "").trim();
    const siteOrigin = String(
      payload?.site_origin || Deno.env.get("SITE_ORIGIN") || "https://delexoo.github.io/PawsForward"
    ).replace(/\/$/, "");

    if (!Number.isFinite(amount) || amount < 1) {
      return json({ error: "Enter at least $1." }, 400);
    }
    if (!referralCode) {
      return json({ error: "Missing employee referral code." }, 400);
    }

    const { data: empRows, error: empErr } = await supabase.rpc("resolve_employee_by_code", {
      p_code: referralCode,
    });
    if (empErr) throw empErr;
    const emp = Array.isArray(empRows) ? empRows[0] : empRows;
    if (!emp?.id) return json({ error: "This QR code is not linked to an employee." }, 404);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const cents = Math.round(amount * 100);
    const employeeName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "PawsForward";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      client_reference_id: referralCode.slice(0, 200),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: "PawsForward donation",
              description: `Donation attributed to ${employeeName}`,
            },
          },
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

    return json({ url: session.url, session_id: session.id, employee: emp });
  } catch (err) {
    console.error(err);
    return json({ error: err?.message || "Could not start checkout." }, 500);
  }
});
