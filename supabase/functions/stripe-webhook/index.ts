import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const body = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET");

  if (!secret) {
    return new Response("Webhook secret missing", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      secret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error(err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid" || session.status === "complete") {
      const amountTotal = Number(session.amount_total || 0) / 100;
      const referralCode =
        session.metadata?.referral_code || session.client_reference_id || "";
      const employeeId = session.metadata?.employee_id || null;
      const donorLabel =
        session.metadata?.donor_label ||
        session.customer_details?.name ||
        session.customer_details?.email ||
        "Stripe donor";

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error } = await supabase.rpc("record_stripe_donation", {
        p_amount: amountTotal,
        p_referral_code: referralCode || null,
        p_employee_id: employeeId,
        p_donor_label: donorLabel,
        p_stripe_session_id: session.id,
        p_stripe_payment_intent:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      });
      if (error) {
        console.error(error);
        return new Response(error.message, { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
