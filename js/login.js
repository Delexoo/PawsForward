(function () {
  const form = document.getElementById("pin-form");
  const input = document.getElementById("pin-input");
  const banner = document.getElementById("status-banner");
  const lockRoot = document.getElementById("site-lock");
  let busy = false;

  function setBanner(msg, opts) {
    if (!banner) return;
    const loading = !!(opts && opts.loading);
    banner.classList.toggle("is-loading", loading);
    if (!msg && !loading) {
      banner.hidden = true;
      banner.textContent = "";
      banner.innerHTML = "";
      lockRoot?.classList.remove("site-lock-shake");
      return;
    }
    banner.hidden = false;
    if (loading) {
      banner.setAttribute("aria-label", "Checking PIN");
      banner.innerHTML =
        '<span class="pf-pin-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      lockRoot?.classList.remove("site-lock-shake");
      return;
    }
    banner.removeAttribute("aria-label");
    banner.textContent = msg;
    lockRoot?.classList.remove("site-lock-shake");
    void lockRoot?.offsetWidth;
    lockRoot?.classList.add("site-lock-shake");
  }

  function nextUrl() {
    const params = new URLSearchParams(location.search);
    let next = String(params.get("next") || "admin").replace(/[^a-z0-9._-]/gi, "");
    next = next.replace(/\.html$/i, "");
    if (!next || next === "login") next = "admin";
    const bust = String(window.SITE_CONFIG?.assetVersion || Date.now());
    return `/${next}?v=${encodeURIComponent(bust)}`;
  }

  async function attempt() {
    if (busy) return;
    if (!window.SitePin?.verifyRemote) {
      setBanner("PIN lock failed to load.");
      return;
    }
    busy = true;
    setBanner("", { loading: true });
    const result = await window.SitePin.verifyRemote(input.value);
    busy = false;
    if (result.ok) {
      location.replace(nextUrl());
      return;
    }
    if (result.reason === "locked") {
      const secs = Math.ceil((result.remainingMs || 0) / 1000);
      setBanner(`Too many attempts. Try again in ${secs}s.`);
      return;
    }
    if (result.reason === "not_configured") {
      setBanner("Operator login is not configured on the server.");
      return;
    }
    if (result.reason === "network") {
      setBanner("Network error — try again.");
      return;
    }
    if (result.reason === "session") {
      setBanner(result.message || "Could not open the dashboard. Try again.");
      return;
    }
    if (result.reason === "invalid") {
      setBanner("Enter all 4 digits.");
      return;
    }
    input.value = "";
    input.focus();
    setBanner(result.message || "Incorrect PIN.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.SitePin?.requireUnlock?.();

    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      attempt();
    });

    input?.addEventListener("input", () => {
      setBanner("");
    });

    const remaining = window.SitePin?.lockoutRemainingMs?.() || 0;
    if (remaining > 0) {
      setBanner(`Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`);
    }
    input?.focus();
  });
})();
