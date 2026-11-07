/**
 * Operator unlock — server-verified PIN + Supabase Auth session.
 * PIN is never compared in the client bundle.
 */
(function (global) {
  "use strict";

  const UNLOCK_KEY = "pf_site_unlock_v1";
  const BYPASS_TAB_KEY = "pf_bypass_tab_v1";
  const ACTIVITY_KEY = "pf_site_activity_v1";
  const FAIL_KEY = "pf_pin_fail_v1";
  const SETTINGS_KEY = "pf_admin_settings_v1";
  const MAX_FAIL = 8;
  const LOCKOUT_MS = 5 * 60 * 1000;
  const IDLE_MS = 24 * 60 * 60 * 1000; // end session after 24h idle

  function isLoginPage() {
    return document.body?.getAttribute("data-page") === "login";
  }

  function isAdminPage() {
    return document.body?.getAttribute("data-page") === "admin";
  }

  function touchActivity() {
    try {
      sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  function idleExpired() {
    try {
      const last = Number(sessionStorage.getItem(ACTIVITY_KEY) || 0);
      if (!last) return false;
      return Date.now() - last > IDLE_MS;
    } catch {
      return false;
    }
  }

  function autoLoginActive() {
    try {
      return global.SiteSupabase?.bypassPinActive?.() === true;
    } catch {
      return false;
    }
  }

  function autoLoginEnabled() {
    try {
      return Boolean(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}").autoLogin);
    } catch {
      return false;
    }
  }

  function isUnlocked() {
    try {
      if (autoLoginActive()) {
        sessionStorage.setItem(UNLOCK_KEY, "1");
        sessionStorage.setItem(BYPASS_TAB_KEY, "1");
        touchActivity();
        return true;
      }
      if (sessionStorage.getItem(BYPASS_TAB_KEY) === "1") {
        sessionStorage.removeItem(UNLOCK_KEY);
        sessionStorage.removeItem(BYPASS_TAB_KEY);
        return false;
      }
      if (sessionStorage.getItem(UNLOCK_KEY) !== "1") return false;
      if (idleExpired()) {
        lock();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  function applyUnlockedUi() {
    document.documentElement.classList.remove("site-lock-active");
    document.body?.classList.add("site-unlocked");
  }

  function applyLockedUi() {
    document.documentElement.classList.add("site-lock-active");
    document.body?.classList.remove("site-unlocked");
  }

  function unlock() {
    try {
      sessionStorage.setItem(UNLOCK_KEY, "1");
      sessionStorage.removeItem(BYPASS_TAB_KEY);
      touchActivity();
      localStorage.removeItem(FAIL_KEY);
    } catch {
      /* ignore */
    }
    applyUnlockedUi();
  }

  async function lock() {
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
      sessionStorage.removeItem(BYPASS_TAB_KEY);
      sessionStorage.removeItem(ACTIVITY_KEY);
    } catch {
      /* ignore */
    }
    try {
      global.SiteSupabase?.clearAutoSession?.();
    } catch {
      /* ignore */
    }
    try {
      await global.SiteSupabase?.signOut?.();
    } catch {
      /* ignore */
    }
    applyLockedUi();
  }

  function readFailState() {
    try {
      return JSON.parse(localStorage.getItem(FAIL_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function lockoutRemainingMs() {
    const until = Number(readFailState().lockedUntil) || 0;
    return Math.max(0, until - Date.now());
  }

  function recordFailure() {
    const state = readFailState();
    const failCount = (Number(state.failCount) || 0) + 1;
    const next = { failCount, lockedUntil: 0 };
    if (failCount >= MAX_FAIL) {
      next.lockedUntil = Date.now() + LOCKOUT_MS;
      next.failCount = 0;
    }
    try {
      localStorage.setItem(FAIL_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }

  function functionsBase() {
    const url = String(global.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function anonKey() {
    return String(global.SITE_CONFIG?.supabaseAnonKey || "");
  }

  async function verifyRemote(entered) {
    const remaining = lockoutRemainingMs();
    if (remaining > 0) {
      return { ok: false, reason: "locked", remainingMs: remaining };
    }
    const digits = String(entered || "").replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) {
      return { ok: false, reason: "invalid" };
    }
    const base = functionsBase();
    const key = anonKey();
    if (!base || !key) {
      return { ok: false, reason: "not_configured" };
    }
    try {
      const res = await fetch(`${base}/operator-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({ pin: digits }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          return {
            ok: false,
            reason: "locked",
            remainingMs: Math.max(lockoutRemainingMs(), 15000),
            message: body.error || "Try again in a few minutes.",
          };
        }
        const fail = recordFailure();
        if (fail.lockedUntil > Date.now()) {
          return { ok: false, reason: "locked", remainingMs: fail.lockedUntil - Date.now() };
        }
        return { ok: false, reason: "mismatch", message: body.error };
      }
      const sb = global.SiteSupabase?.getClient?.();
      if (!sb || !body.access_token || !body.refresh_token) {
        return { ok: false, reason: "session" };
      }
      const { error } = await sb.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (error) return { ok: false, reason: "session" };
      await global.PfSession?.publish?.(
        { access_token: body.access_token, refresh_token: body.refresh_token },
        "operator",
        autoLoginEnabled()
      );
      unlock();
      if (autoLoginEnabled()) await global.SiteSupabase?.persistAutoSession?.();
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, reason: "network" };
    }
  }

  let loginSettled = false;

  function settleLogin() {
    if (loginSettled) return;
    loginSettled = true;
    document.documentElement.classList.remove("site-lock-active");
    document.body?.classList.remove("site-unlocked");
    const goAdmin = () => {
      const bust = String(global.SITE_CONFIG?.assetVersion || Date.now());
      location.replace(`/admin?v=${encodeURIComponent(bust)}`);
    };

    // Fast path: bypass is on — jump to admin immediately. Middleware + admin hydrate own the cookie.
    if (autoLoginActive()) {
      unlock();
      goAdmin();
      return;
    }

    const pending = global.PfSession?.hydrate?.();
    if (!pending || typeof pending.then !== "function") {
      try {
        sessionStorage.removeItem(UNLOCK_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    pending
      .then((session) => {
        if (session?.role === "operator" && session.access_token) {
          unlock();
          goAdmin();
          return;
        }
        try {
          sessionStorage.removeItem(UNLOCK_KEY);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        try {
          sessionStorage.removeItem(UNLOCK_KEY);
        } catch {
          /* ignore */
        }
      });
  }

  function requireUnlock() {
    if (isLoginPage()) {
      settleLogin();
      return true;
    }
    if (isUnlocked()) {
      applyUnlockedUi();
      touchActivity();
      return true;
    }
    applyLockedUi();
    const leaf = String(location.pathname.split("/").pop() || "admin").replace(/\.html$/i, "") || "admin";
    const next = encodeURIComponent(leaf);
    location.replace("/login?next=" + next);
    return false;
  }

  function startIdleWatch() {
    if (!isAdminPage()) return;
    const bump = () => {
      if (isUnlocked()) touchActivity();
    };
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach((evt) => {
      window.addEventListener(evt, bump, { passive: true });
    });
    window.setInterval(() => {
      if (!isUnlocked() && isAdminPage()) {
        location.replace("/login?next=admin");
      }
    }, 60 * 1000);
  }

  function bootUi() {
    if (isLoginPage()) {
      settleLogin();
      return;
    }
    if (isUnlocked()) {
      applyUnlockedUi();
    } else if (isAdminPage()) applyLockedUi();
  }

  if (document.body) {
    bootUi();
    startIdleWatch();
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        bootUi();
        startIdleWatch();
      },
      { once: true }
    );
  }

  global.SitePin = {
    verifyRemote,
    unlock,
    lock,
    isUnlocked,
    requireUnlock,
    lockoutRemainingMs,
    touchActivity,
  };
})(window);
