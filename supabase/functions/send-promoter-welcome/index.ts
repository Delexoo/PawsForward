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
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(shareUrl)}`;

    const from =
      Deno.env.get("RESEND_FROM") ||
      "Paws Forward <joinpawsforward@outlook.com>";

    const html = `<!doctype html>
<html><body style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d1d1f;line-height:1.5;padding:24px;">
  <p>Hi ${escapeHtml(name)} — you’re in at Paws Forward.</p>
  <p>Your donation link:<br><a href="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</a></p>
  <p>Your QR (save this image or open the QR page):</p>
  <p><img src="${escapeHtml(qrImg)}" width="280" height="280" alt="Your Paws Forward QR" style="display:block;border:0;"></p>
  <p><a href="${escapeHtml(qrPage)}">Open your QR page</a></p>
  <p>Code: <strong>${escapeHtml(referralCode)}</strong></p>
  <p style="color:#6e6e73;font-size:14px;">Share the link or QR — gifts through them count toward your payout.</p>
</body></html>`;

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
