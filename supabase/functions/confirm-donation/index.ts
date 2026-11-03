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

    const { session_id: sessionId } = await req.json();
    if (!sessionId) return json({ error: "Missing session_id." }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));

    if (session.payment_status !== "paid" && session.status !== "complete") {
      return json({ error: "Payment is not complete yet.", status: session.payment_status }, 402);
    }

    const amountTotal = Number(session.amount_total || 0) / 100;
    const referralCode =
      session.metadata?.referral_code || session.client_reference_id || "";
    const employeeId = session.metadata?.employee_id || null;
    const donorLabel =
      session.metadata?.donor_label ||
      session.customer_details?.name ||
      session.customer_details?.email ||
      "Stripe donor";

    const { data, error } = await supabase.rpc("record_stripe_donation", {
      p_amount: amountTotal,
      p_referral_code: referralCode || null,
      p_employee_id: employeeId,
      p_donor_label: donorLabel,
      p_stripe_session_id: session.id,
      p_stripe_payment_intent:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    if (error) throw error;

    return json({ ok: true, donation: data });
  } catch (err) {
    console.error(err);
    return json({ error: err?.message || "Could not confirm donation." }, 500);
  }
});
