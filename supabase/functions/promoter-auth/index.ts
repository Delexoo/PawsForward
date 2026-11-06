import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { ALLOWED_ORIGINS, corsHeaders } from "./cors.ts";

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

function siteOrigin(raw: string) {
  const origin = String(raw || "").trim().replace(/\/$/, "");
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return "https://joinpawsforward.com";
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
    const email = String(payload?.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) {
      return json(req, { error: "Enter a valid email." }, 400);
    }

    const supabase = adminClient();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const [{ count: emailSends }, { count: recentSends }] = await Promise.all([
      supabase
        .from("promoter_auth_sends")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", hourAgo),
      supabase
        .from("promoter_auth_sends")
        .select("id", { count: "exact", head: true })
        .gte("created_at", minuteAgo),
    ]);
    if ((emailSends || 0) >= 5 || (recentSends || 0) >= 30) {
      return json(req, { error: "Too many emails. Try again in a little while." }, 429);
    }

    const { data: rows, error: rowErr } = await supabase
      .from("employees")
      .select("id, first_name, email")
      .ilike("email", email);
    if (rowErr) throw rowErr;
    if (!rows?.length) return json(req, { ok: true, sent: false });

    let operatorEmail = "";
    try {
      const { data } = await supabase.rpc("app_secret", { p_key: "operator_email" });
      operatorEmail = String(data || "").trim().toLowerCase();
    } catch {
      operatorEmail = "";
    }
    if (operatorEmail && email === operatorEmail) return json(req, { ok: true, sent: false });

    const created = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: "promoter" },
    });
    const already = /already|registered|exists/i.test(String(created.error?.message || ""));
    if (created.error && !already) throw created.error;

    const linked = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linked.error || !linked.data?.properties?.hashed_token) {
      throw linked.error || new Error("Could not create a sign-in link.");
    }

    const userId = linked.data.user?.id || created.data?.user?.id;
    if (userId) {
      const { error: linkErr } = await supabase
        .from("employees")
        .update({ user_id: userId })
        .ilike("email", email)
        .or(`user_id.is.null,user_id.eq.${userId}`);
      if (linkErr) throw linkErr;
    }

    const origin = siteOrigin(String(payload?.site_origin || ""));
    const tokenHash = linked.data.properties.hashed_token;
    const code = String(linked.data.properties.email_otp || "").trim();
    const link =
      `${origin}/account?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink`;
    const name = String(rows[0]?.first_name || "").trim() || "there";
    const apiKey = await resendApiKey(supabase);
    if (!apiKey) return json(req, { error: "Email sending is not configured yet." }, 503);

    const from = Deno.env.get("RESEND_FROM") || "Paws Forward <joinpawsforward@outlook.com>";
    const codeBlock = code
      ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Or enter this code</p><p style="margin:0 0 28px;font-size:28px;font-weight:700;letter-spacing:0.18em;">${escapeHtml(code)}</p>`
      : "";
    const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:40px 20px;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #000;font-size:16px;font-weight:700;">Paws Forward</p>
    <h1 style="margin:0 0 12px;font-size:24px;">Hi ${escapeHtml(name)},</h1>
    <p style="margin:0 0 24px;font-size:15px;">Use this link to sign in and see your balance, QR, and payout method. It expires soon.</p>
    <p style="margin:0 0 28px;"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;background:#000;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Sign in</a></p>
    ${codeBlock}
    <p style="margin:0;padding-top:24px;border-top:1px solid #000;font-size:13px;">If you didn't ask for this, you can ignore the email.</p>
  </div>
</body></html>`;
    const text =
      `Hi ${name},\n\nSign in to your Paws Forward dashboard:\n${link}\n\n` +
      (code ? `Or enter this code: ${code}\n\n` : "") +
      `If you didn't ask for this, ignore this email.`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Sign in to your Paws Forward dashboard",
        html,
        text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("resend error", body?.message || res.status);
      return json(req, { error: "Could not send the sign-in email." }, 502);
    }

    await supabase.from("promoter_auth_sends").insert({ email });
    return json(req, { ok: true, sent: true });
  } catch (err) {
    console.error(err);
    return json(req, { error: "Could not start sign-in." }, 500);
  }
});
