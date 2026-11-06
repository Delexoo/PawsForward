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

    const code = String(linked.data.properties.email_otp || "").replace(/\D/g, "");
    if (code.length < 6) {
      return json(req, { error: "Could not create a sign-in code." }, 500);
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

    const apiKey = await resendApiKey(supabase);
    if (!apiKey) return json(req, { error: "Email sending is not configured yet." }, 503);

    const from = Deno.env.get("RESEND_FROM") || "Paws Forward <joinpawsforward@outlook.com>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your sign-in code",
        text: code,
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
