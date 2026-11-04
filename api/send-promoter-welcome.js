const ALLOWED_ORIGINS = new Set([
  "https://joinpawsforward.com",
  "https://www.joinpawsforward.com",
  "https://delexoo.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
]);

function corsHeaders(origin) {
  const match = ALLOWED_ORIGINS.has(origin) ? origin : "https://joinpawsforward.com";
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers": "content-type, authorization, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(res, origin, body, status = 200) {
  res.statusCode = status;
  const headers = {
    ...corsHeaders(origin),
    "Content-Type": "application/json",
  };
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeEmail({ name, shareUrl, qrPage, qrImg, referralCode, siteOrigin, brandMark }) {
  const safeName = escapeHtml(name);
  const safeShare = escapeHtml(shareUrl);
  const safeQrPage = escapeHtml(qrPage);
  const safeQrImg = escapeHtml(qrImg);
  const safeCode = escapeHtml(referralCode);
  const safeOrigin = escapeHtml(siteOrigin);
  const safeMark = escapeHtml(brandMark);

  const font =
    "Arial,Helvetica,sans-serif";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>You’re in · Paws Forward</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;color:#000000;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your donation link and QR are ready.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 28px;border-bottom:1px solid #000000;">
              <a href="${safeOrigin}" style="text-decoration:none;color:#000000;font-family:${font};font-size:16px;font-weight:700;letter-spacing:-0.02em;">
                <img src="${safeMark}" width="24" height="24" alt="" style="display:inline-block;vertical-align:middle;border:0;">
                <span style="display:inline-block;vertical-align:middle;margin-left:8px;">Paws Forward</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 0 0;">
              <h1 style="margin:0 0 12px;font-family:${font};font-size:24px;line-height:1.25;font-weight:700;color:#000000;">Hi ${safeName},</h1>
              <p style="margin:0 0 28px;font-family:${font};font-size:15px;line-height:1.55;color:#000000;">
                You’re in. Your donation link and QR are below — share either one and gifts count toward your payout.
              </p>

              <p style="margin:0 0 12px;font-family:${font};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000000;">Your QR</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="border:1px solid #000000;padding:24px;">
                    <img src="${safeQrImg}" width="200" height="200" alt="Your Paws Forward QR code" style="display:block;margin:0 auto;border:0;background:#ffffff;">
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-family:${font};font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#000000;">Donation link</p>
              <p style="margin:0 0 24px;font-family:${font};font-size:14px;line-height:1.5;word-break:break-all;">
                <a href="${safeShare}" style="color:#000000;text-decoration:underline;">${safeShare}</a>
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#000000;">
                    <a href="${safeShare}" style="display:inline-block;padding:12px 20px;font-family:${font};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open donation link</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-family:${font};font-size:14px;line-height:1.5;color:#000000;">
                <a href="${safeQrPage}" style="color:#000000;text-decoration:underline;">Open QR page</a>
              </p>
              <p style="margin:0;padding-top:24px;border-top:1px solid #000000;font-family:${font};font-size:13px;line-height:1.5;color:#000000;">
                Code: <strong>${safeCode}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 0 0;font-family:${font};font-size:12px;line-height:1.5;color:#000000;">
              Helping dogs get food, water, and shelter.<br>
              <a href="${safeOrigin}" style="color:#000000;text-decoration:underline;">joinpawsforward.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `Hi ${name} — you’re in at Paws Forward.\n\n` +
    `Your donation link and QR are ready. Share either one — gifts through them count toward your payout.\n\n` +
    `Donation link:\n${shareUrl}\n\n` +
    `QR page:\n${qrPage}\n\n` +
    `Code: ${referralCode}\n\n` +
    `— Paws Forward\n${siteOrigin}`;

  return { html, text };
}

async function resolvePromoter(referralCode) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = String(process.env.SUPABASE_ANON_KEY || "").trim();
  if (!base || !anon) return null;
  const res = await fetch(`${base}/rest/v1/rpc/resolve_employee_by_code`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_code: referralCode }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? row : null;
}

module.exports = async function handler(req, res) {
  const origin = String(req.headers.origin || "").trim();

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(corsHeaders(origin))) res.setHeader(k, v);
    return res.end();
  }

  if (req.method !== "POST") {
    return json(res, origin, { error: "Method not allowed" }, 405);
  }

  try {
    let payload = {};
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      payload = req.body;
    } else if (typeof req.body === "string" && req.body.trim()) {
      payload = JSON.parse(req.body);
    } else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      payload = raw ? JSON.parse(raw) : {};
    }

    const referralCode = String(payload.referral_code || "").trim();
    const email = String(payload.email || "")
      .trim()
      .toLowerCase();
    const siteOrigin = String(
      payload.site_origin || process.env.SITE_ORIGIN || "https://joinpawsforward.com"
    )
      .trim()
      .replace(/\/$/, "");

    if (!referralCode || !email) {
      return json(res, origin, { error: "Missing referral code or email." }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) {
      return json(res, origin, { error: "Invalid email." }, 400);
    }

    const emp = await resolvePromoter(referralCode);
    if (!emp) {
      return json(res, origin, { error: "Promoter not found." }, 404);
    }

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      return json(res, origin, { error: "Email sending is not configured yet." }, 503);
    }

    const name = String(emp.first_name || "").trim() || "there";
    const shareUrl =
      String(payload.share_url || "").trim() ||
      `${siteOrigin}/donate?ref=${encodeURIComponent(referralCode)}`;
    const qrPage =
      String(payload.qr_page_url || "").trim() ||
      `${siteOrigin}/qr?ref=${encodeURIComponent(referralCode)}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&color=000000&bgcolor=ffffff&data=${encodeURIComponent(shareUrl)}`;
    const brandMark = `${siteOrigin}/doc/brand-mark.png`;

    const from =
      String(process.env.RESEND_FROM || "").trim() ||
      "Paws Forward <onboarding@resend.dev>";

    const { html, text } = buildWelcomeEmail({
      name,
      shareUrl,
      qrPage,
      qrImg,
      referralCode,
      siteOrigin,
      brandMark,
    });

    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You’re in — your Paws Forward QR is ready",
        html,
        text,
      }),
    });

    const body = await mailRes.json().catch(() => ({}));
    if (!mailRes.ok) {
      console.error("resend error", body);
      return json(
        res,
        origin,
        { error: body.message || "Could not send welcome email." },
        mailRes.status >= 400 && mailRes.status < 600 ? mailRes.status : 502
      );
    }

    return json(res, origin, { ok: true, id: body.id || null });
  } catch (err) {
    console.error(err);
    return json(res, origin, { error: err?.message || "Could not send email." }, 500);
  }
};
