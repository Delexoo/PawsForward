/**
 * Shared Supabase browser client — one client per page.
 * Auth session stays in memory only (not localStorage / sessionStorage).
 * login.html → admin.html uses a one-shot window.name handoff.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "pf-admin-auth";
  const HANDOFF_PREFIX = "pf_auth_handoff_v1:";

  let client = null;
  /** In-memory auth storage — cleared on full page reload. */
  const memoryStore = new Map();

  const memoryAuthStorage = {
    getItem(key) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    },
    setItem(key, value) {
      memoryStore.set(String(key), String(value));
    },
    removeItem(key) {
      memoryStore.delete(String(key));
    },
  };

  function scrubLegacyWebStorage() {
    try {
      global.sessionStorage?.removeItem?.(STORAGE_KEY);
      global.localStorage?.removeItem?.(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

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
    scrubLegacyWebStorage();
    const { url, key } = cfg();
    client = global.supabase.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: memoryAuthStorage,
        storageKey: STORAGE_KEY,
      },
    });
    return client;
  }

  function stashSessionHandoff(session) {
    if (!session?.access_token || !session?.refresh_token) return;
    try {
      global.name =
        HANDOFF_PREFIX +
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
    } catch {
      /* ignore */
    }
  }

  async function consumeSessionHandoff() {
    const sb = getClient();
    if (!sb) return false;
    const raw = String(global.name || "");
    if (!raw.startsWith(HANDOFF_PREFIX)) return false;
    try {
      const payload = JSON.parse(raw.slice(HANDOFF_PREFIX.length));
      global.name = "";
      const { error } = await sb.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
      return !error;
    } catch {
      global.name = "";
      return false;
    }
  }

  async function requireAdminSession() {
    const sb = getClient();
    if (!sb) return { ok: false, reason: "config" };
    await consumeSessionHandoff();
    const { data, error } = await sb.auth.getSession();
    if (error) return { ok: false, reason: "error", error };
    if (!data?.session) return { ok: false, reason: "signed_out" };
    return { ok: true, session: data.session, user: data.session.user, client: sb };
  }

  async function signOut() {
    const sb = getClient();
    try {
      global.name = "";
    } catch {
      /* ignore */
    }
    if (!sb) {
      memoryStore.clear();
      scrubLegacyWebStorage();
      return;
    }
    await sb.auth.signOut({ scope: "local" });
    memoryStore.clear();
    scrubLegacyWebStorage();
  }

  global.SiteSupabase = {
    getClient,
    canUse,
    requireAdminSession,
    stashSessionHandoff,
    consumeSessionHandoff,
    signOut,
  };
})(window);
