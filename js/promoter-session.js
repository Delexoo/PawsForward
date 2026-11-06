(function (global) {
  "use strict";

  const STORAGE_KEY = "pf-promoter-auth";
  let client = null;

  function getClient() {
    if (client) return client;
    const cfg = global.SITE_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !global.supabase?.createClient) return null;
    client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: STORAGE_KEY,
      },
    });
    return client;
  }

  function clearAuthQuery() {
    const url = new URL(location.href);
    if (!url.searchParams.has("token_hash") && !url.searchParams.has("type") && !url.searchParams.has("code")) {
      return;
    }
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    url.searchParams.delete("code");
    history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  async function finishLink() {
    const sb = getClient();
    const params = new URLSearchParams(location.search);
    const tokenHash = String(params.get("token_hash") || "").trim();
    const type = String(params.get("type") || "magiclink").trim() || "magiclink";
    if (!tokenHash) return { ok: false, skipped: true };
    if (!sb) return { ok: false, error: new Error("Sign-in is not configured.") };
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    clearAuthQuery();
    if (error) return { ok: false, error };
    return { ok: true };
  }

  async function verifyCode(email, token) {
    const sb = getClient();
    if (!sb) return { ok: false, error: new Error("Sign-in is not configured.") };
    let last = null;
    for (const type of ["magiclink", "email"]) {
      const { error } = await sb.auth.verifyOtp({
        email,
        token,
        type,
      });
      if (!error) return { ok: true };
      last = error;
    }
    return { ok: false, error: last };
  }

  async function requestLink(email) {
    const cfg = global.SITE_CONFIG || {};
    const base = String(cfg.supabaseUrl || "").replace(/\/$/, "");
    const key = String(cfg.supabaseAnonKey || "");
    if (!base || !key) return { ok: false, error: "Sign-in is not configured." };
    const res = await fetch(`${base}/functions/v1/promoter-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        email,
        site_origin: cfg.siteOrigin || location.origin,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) return { ok: false, error: body.error || "Too many emails. Try again in a little while." };
    if (!res.ok) return { ok: false, error: body.error || "Could not send the sign-in email." };
    return { ok: true, sent: body.sent !== false };
  }

  async function signOut() {
    const sb = getClient();
    if (!sb) return;
    await sb.auth.signOut({ scope: "local" });
  }

  global.PfPromoter = { getClient, finishLink, verifyCode, requestLink, signOut };
})(window);
