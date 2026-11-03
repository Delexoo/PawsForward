/**
 * Session PIN unlock for PawsForward admin pages.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "pf_site_unlock_v1";
  const FAIL_KEY = "pf_pin_fail_v1";
  const MAX_FAIL = 8;
  const LOCKOUT_MS = 5 * 60 * 1000;

  function configuredPin() {
    const pin = String(global.SITE_CONFIG?.sitePin || "").replace(/\D/g, "");
    return pin.length === 4 ? pin : "";
  }

  function isPublicPage() {
    return false;
  }

  function isLoginPage() {
    return document.body?.getAttribute("data-page") === "login";
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
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
      sessionStorage.setItem(STORAGE_KEY, "1");
      localStorage.removeItem(FAIL_KEY);
    } catch {
      /* ignore */
    }
    applyUnlockedUi();
  }

  function lock() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
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

  function verify(entered) {
    const pin = configuredPin();
    if (!pin) {
      return { ok: false, reason: "not_configured" };
    }
    const remaining = lockoutRemainingMs();
    if (remaining > 0) {
      return { ok: false, reason: "locked", remainingMs: remaining };
    }
    const digits = String(entered || "").replace(/\D/g, "").slice(0, 4);
    if (digits.length !== 4) {
      return { ok: false, reason: "invalid" };
    }
    if (digits !== pin) {
      const fail = recordFailure();
      if (fail.lockedUntil > Date.now()) {
        return { ok: false, reason: "locked", remainingMs: fail.lockedUntil - Date.now() };
      }
      return { ok: false, reason: "mismatch" };
    }
    unlock();
    return { ok: true };
  }

  function requireUnlock() {
    if (isPublicPage()) {
      applyUnlockedUi();
      return true;
    }
    if (isLoginPage()) {
      if (isUnlocked()) {
        const bust = String(global.SITE_CONFIG?.assetVersion || Date.now());
        location.replace(`admin.html?v=${encodeURIComponent(bust)}`);
        return false;
      }
      // Keep login form visible; do not apply the full lock hide.
      document.documentElement.classList.remove("site-lock-active");
      document.body?.classList.remove("site-unlocked");
      return true;
    }
    if (isUnlocked()) {
      applyUnlockedUi();
      return true;
    }
    applyLockedUi();
    const next = encodeURIComponent(location.pathname.split("/").pop() || "admin.html");
    location.replace("login.html?next=" + next);
    return false;
  }

  function bootUi() {
    if (isPublicPage() || isUnlocked()) applyUnlockedUi();
    else if (isLoginPage()) {
      document.documentElement.classList.remove("site-lock-active");
      document.body?.classList.remove("site-unlocked");
    } else applyLockedUi();
  }

  // Early paint lock for operator pages (before DOMContentLoaded).
  if (document.body) bootUi();
  else document.addEventListener("DOMContentLoaded", bootUi, { once: true });

  global.SitePin = {
    verify,
    unlock,
    lock,
    isUnlocked,
    requireUnlock,
    configuredPin,
    lockoutRemainingMs,
  };
})(window);
