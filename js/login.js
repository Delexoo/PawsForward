(function () {
  const form = document.getElementById("pin-form");
  const input = document.getElementById("pin-input");
  const banner = document.getElementById("status-banner");
  const lockRoot = document.getElementById("site-lock");

  function setBanner(msg) {
    if (!banner) return;
    if (!msg) {
      banner.hidden = true;
      banner.textContent = "";
      lockRoot?.classList.remove("site-lock-shake");
      return;
    }
    banner.hidden = false;
    banner.textContent = msg;
    lockRoot?.classList.remove("site-lock-shake");
    void lockRoot?.offsetWidth;
    lockRoot?.classList.add("site-lock-shake");
  }

  function nextUrl() {
    const params = new URLSearchParams(location.search);
    const next = String(params.get("next") || "admin.html").replace(/[^a-z0-9._-]/gi, "");
    if (!next || next === "login.html") return "admin.html";
    return next;
  }

  function attempt() {
    if (!window.SitePin) {
      setBanner("PIN lock failed to load.");
      return;
    }
    if (!window.SitePin.configuredPin()) {
      setBanner("Set sitePin (4 digits) in js/config.js.");
      return;
    }
    const result = window.SitePin.verify(input.value);
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
      setBanner("Set sitePin (4 digits) in js/config.js.");
      return;
    }
    input.value = "";
    input.focus();
    setBanner("Incorrect PIN.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.SitePin?.requireUnlock?.();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      attempt();
    });

    input?.addEventListener("input", () => {
      setBanner("");
      input.value = String(input.value || "").replace(/\D/g, "").slice(0, 4);
      if (input.value.length === 4) attempt();
    });

    input?.focus();
  });
})();
