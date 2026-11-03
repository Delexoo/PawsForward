/**
 * Shared Supabase browser client — one client per page.
 * Admin session uses sessionStorage (tab-scoped) so login → admin survives navigation
 * without writing a long-lived token to localStorage.
 */
(function (global) {
  let client = null;

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function canUse() {
    const { url, key } = cfg();
    return !!(url && key && global.supabase?.createClient);
  }

  function getClient() {
    if (client) return client;
    if (!canUse()) return null;
    const { url, key } = cfg();
    client = global.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: global.sessionStorage,
        storageKey: "pf-admin-auth",
      },
    });
    return client;
  }

  async function requireAdminSession() {
    const sb = getClient();
    if (!sb) return { ok: false, reason: "config" };
    const { data, error } = await sb.auth.getSession();
    if (error) return { ok: false, reason: "error", error };
    if (!data?.session) return { ok: false, reason: "signed_out" };
    return { ok: true, session: data.session, user: data.session.user, client: sb };
  }

  global.SiteSupabase = { getClient, canUse, requireAdminSession };
})(window);
