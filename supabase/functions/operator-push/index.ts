import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function appSecret(supabase: ReturnType<typeof adminClient>, key: string) {
  const { data, error } = await supabase.rpc("app_secret", { p_key: key });
  if (error) throw error;
  return String(data || "");
}

function alertCopy(payload: Record<string, unknown>) {
  const kind = String(payload.kind || "");
  const name = String(payload.name || "").trim();
  const place = String(payload.place || "").trim();
  const id = String(payload.id || "");
  if (kind === "qr_created") {
    return {
      kind,
      title: "New QR code",
      body: `${name || "Someone"} created a referral QR.`,
      tag: `qr-${id}`,
    };
  }
  if (kind === "qr_scanned") {
    const who = name && name !== "A QR code" ? `${name}'s QR` : "A QR code";
    return {
      kind,
      title: "QR scan",
      body: place ? `${who} was scanned in ${place}.` : `${who} was scanned.`,
      tag: `scan-${id}`,
    };
  }
  if (kind === "donation") {
    const amount = Number(payload.amount);
    const money = Number.isFinite(amount)
      ? amount.toLocaleString("en-US", { style: "currency", currency: "USD" })
      : "A";
    return {
      kind,
      title: "New donation",
      body: `${money} gift${name ? ` for ${name}` : ""}.`,
      tag: `gift-${id}`,
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const supabase = adminClient();
    const secret = await appSecret(supabase, "operator_push_secret");
    const given = String(req.headers.get("x-push-secret") || "");
    if (!secret || !safeEqual(given, secret)) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const alert = alertCopy(payload && typeof payload === "object" ? payload : {});
    if (!alert) return json({ error: "Unknown alert." }, 400);

    const flag =
      alert.kind === "qr_created"
        ? "notify_qr_created"
        : alert.kind === "qr_scanned"
          ? "notify_qr_scanned"
          : "notify_donation";

    const publicKey = await appSecret(supabase, "vapid_public_key");
    const privateKey = await appSecret(supabase, "vapid_private_key");
    if (!publicKey || !privateKey) return json({ error: "Push is not configured." }, 503);
    webpush.setVapidDetails("mailto:joinpawsforward@outlook.com", publicKey, privateKey);

    const { data: subs, error } = await supabase
      .from("operator_push_subscriptions")
      .select("endpoint, p256dh, auth, notify_qr_created, notify_qr_scanned, notify_donation")
      .eq(flag, true);
    if (error) throw error;

    let sent = 0;
    for (const sub of subs || []) {
      if (!sub.endpoint || !sub.p256dh || !sub.auth) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: alert.title, body: alert.body, tag: alert.tag, kind: alert.kind })
        );
        sent += 1;
      } catch (err) {
        const status = Number((err as { statusCode?: number })?.statusCode || 0);
        if (status === 404 || status === 410) {
          await supabase.from("operator_push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error("push failed", status || "unknown");
        }
      }
    }
    return json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not send the alert." }, 500);
  }
});
