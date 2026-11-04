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

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resendApiKey(supabase: ReturnType<typeof adminClient>) {
  const envKey = Deno.env.get("RESEND_API_KEY");
  if (envKey) return envKey;
  try {
    const { data, error } = await supabase.rpc("app_secret", { p_key: "resend_api_key" });
    if (error) throw error;
    return data as string | null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const payload = await req.json().catch(() => ({}));
    const referralCode = String(payload?.referral_code || "").trim();
    const email = String(payload?.email || "")
      .trim()
      .toLowerCase();
    const siteOrigin = String(
      payload?.site_origin || Deno.env.get("SITE_ORIGIN") || "https://joinpawsforward.com"
    )
      .trim()
      .replace(/\/$/, "");

    if (!referralCode || !email) {
      return json(req, { error: "Missing referral code or email." }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) {
      return json(req, { error: "Invalid email." }, 400);
    }

    const supabase = adminClient();
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id, first_name, email, referral_code")
      .eq("referral_code", referralCode)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!emp?.id) return json(req, { error: "Promoter not found." }, 404);
    if (String(emp.email || "").toLowerCase() !== email) {
      return json(req, { error: "Email does not match this QR." }, 403);
    }

    const apiKey = await resendApiKey(supabase);
    if (!apiKey) {
      return json(req, { error: "Email sending is not configured yet." }, 503);
    }

    const name = String(emp.first_name || "").trim() || "there";
    const shareUrl =
      String(payload?.share_url || "").trim() ||
      `${siteOrigin}/donate?ref=${encodeURIComponent(referralCode)}`;
    const qrPage =
      String(payload?.qr_page_url || "").trim() ||
      `${siteOrigin}/qr?ref=${encodeURIComponent(referralCode)}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=000000&bgcolor=ffffff&data=${encodeURIComponent(shareUrl)}`;

    const from =
      Deno.env.get("RESEND_FROM") ||
      "Paws Forward <joinpawsforward@outlook.com>";

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light only">
  <title>You’re in · Paws Forward</title>
</head>
<body style="margin:0;padding:40px 20px;background:#ffffff;color:#000000;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #000000;font-size:16px;font-weight:700;">Paws Forward</p>
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#000000;">Hi ${escapeHtml(name)},</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#000000;">You’re in. Your donation link and QR are below — share either one and gifts count toward your payout.</p>
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000000;">Your QR</p>
    <p style="margin:0 0 28px;padding:24px;border:1px solid #000000;text-align:center;">
      <img src="${escapeHtml(qrImg)}" width="200" height="200" alt="Your Paws Forward QR" style="display:block;margin:0 auto;border:0;background:#ffffff;">
    </p>
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000000;">Donation link</p>
    <p style="margin:0 0 24px;font-size:14px;word-break:break-all;"><a href="${escapeHtml(shareUrl)}" style="color:#000000;text-decoration:underline;">${escapeHtml(shareUrl)}</a></p>
    <p style="margin:0 0 16px;"><a href="${escapeHtml(shareUrl)}" style="display:inline-block;padding:12px 20px;background:#000000;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Open donation link</a></p>
    <p style="margin:0 0 24px;font-size:14px;"><a href="${escapeHtml(qrPage)}" style="color:#000000;text-decoration:underline;">Open QR page</a></p>
    <p style="margin:0;padding-top:24px;border-top:1px solid #000000;font-size:13px;color:#000000;">Code: <strong>${escapeHtml(referralCode)}</strong></p>
    <p style="margin:32px 0 0;font-size:12px;color:#000000;">Helping dogs get food, water, and shelter.<br><a href="${escapeHtml(siteOrigin)}" style="color:#000000;text-decoration:underline;">joinpawsforward.com</a></p>
  </div>
</body>
</html>`;

    const text =
      `Hi ${name} — you’re in at Paws Forward!\n\n` +
      `Your donation link:\n${shareUrl}\n\n` +
      `Your QR page:\n${qrPage}\n\n` +
      `Code: ${referralCode}\n` +
      `Share the link or QR — gifts through them count toward your payout.`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your Paws Forward QR and link",
        html,
        text,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("resend error", body);
      return json(
        req,
        { error: body?.message || "Could not send welcome email." },
        res.status >= 400 && res.status < 600 ? res.status : 502
      );
    }

    return json(req, { ok: true, id: body?.id || null });
  } catch (err) {
    console.error(err);
    return json(req, { error: (err as Error)?.message || "Could not send email." }, 500);
  }
});
