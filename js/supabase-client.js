/**
 * Shared Supabase browser client — one client per page.
 * Auth session stays in memory only (not localStorage / sessionStorage).
 * login.html → admin.html uses a one-shot window.name handoff.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "pf-admin-auth";
  const HANDOFF_PREFIX = "pf_auth_handoff_v1:";
  const AUTO_KEY = "pf_auto_login_v1";
  const SETTINGS_KEY = "pf_admin_settings_v1";
  const AUTO_MS = 7 * 24 * 60 * 60 * 1000;
  const AUTO_SKEW_MS = 60 * 1000;

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
    client.auth.onAuthStateChange((_event, session) => {
      if (!bypassSettingOn()) {
        clearAutoSession();
        return;
      }
      if (!session?.refresh_token) return;
      const saved = readAutoRecord();
      if (!saved) return;
      writeAutoRecord(saved.until, session);
    });
    return client;
  }

  function bypassSettingOn() {
    try {
      return JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || "null")?.autoLogin === true;
    } catch {
      return false;
    }
  }

  function deadlineAllowed(until) {
    const now = Date.now();
    return Number.isFinite(until) && until > now && until <= now + AUTO_MS + AUTO_SKEW_MS;
  }

  function readAutoRecord() {
    let parsed = null;
    try {
      parsed = JSON.parse(global.localStorage.getItem(AUTO_KEY) || "null");
    } catch {
      clearAutoSession();
      return null;
    }
    if (!parsed) return null;
    const until = Number(parsed.until);
    const refresh = typeof parsed.refresh_token === "string" ? parsed.refresh_token : "";
    const access = typeof parsed.access_token === "string" ? parsed.access_token : "";
    if (!bypassSettingOn() || !refresh || !access || !deadlineAllowed(until)) {
      clearAutoSession();
      return null;
    }
    return parsed;
  }

  function bypassPinActive() {
    return Boolean(readAutoRecord());
  }

  function writeAutoRecord(until, session) {
    global.localStorage.setItem(
      AUTO_KEY,
      JSON.stringify({
        until,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    );
  }

  function autoLoginUntil() {
    return readAutoRecord()?.until || 0;
  }

  function clearAutoSession() {
    try {
      global.localStorage.removeItem(AUTO_KEY);
    } catch {
      /* ignore */
    }
  }

  async function persistAutoSession(session) {
    if (!bypassSettingOn()) {
      clearAutoSession();
      return 0;
    }
    const sb = getClient();
    let current = session;
    if (!current?.refresh_token && sb) {
      const { data } = await sb.auth.getSession();
      current = data?.session;
    }
    if (!current?.access_token || !current?.refresh_token) return 0;
    let until = Date.now() + AUTO_MS;
    try {
      const parsed = JSON.parse(global.localStorage.getItem(AUTO_KEY) || "null");
      const prev = Number(parsed?.until);
      if (deadlineAllowed(prev)) until = prev;
    } catch {
      /* start a new 7-day window */
    }
    try {
      writeAutoRecord(until, current);
    } catch {
      return 0;
    }
    return until;
  }

  async function restoreAutoSession() {
    const saved = readAutoRecord();
    const sb = getClient();
    if (!saved || !sb) return false;
    const { error } = await sb.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
    });
    if (error) {
      clearAutoSession();
      return false;
    }
    return true;
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
    let { data, error } = await sb.auth.getSession();
    if (!data?.session) {
      const restored = await restoreAutoSession();
      if (restored) ({ data, error } = await sb.auth.getSession());
    }
    if (error) return { ok: false, reason: "error", error };
    if (!data?.session) return { ok: false, reason: "signed_out" };
    return { ok: true, session: data.session, user: data.session.user, client: sb };
  }

  async function signOut() {
    const sb = getClient();
    clearAutoSession();
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
    persistAutoSession,
    restoreAutoSession,
    clearAutoSession,
    bypassPinActive,
    autoLoginUntil,
    signOut,
  };
})(window);
