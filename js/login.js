(function () {
  const form = document.getElementById("pin-form");
  const input = document.getElementById("pin-input");
  const banner = document.getElementById("status-banner");
  const submit = document.getElementById("pin-submit");

  function setBanner(msg, kind) {
    if (!banner) return;
    if (!msg) {
      banner.hidden = true;
      banner.textContent = "";
      banner.classList.remove("is-ok", "is-err");
      return;
    }
    banner.hidden = false;
    banner.textContent = msg;
    banner.classList.toggle("is-ok", kind === "ok");
    banner.classList.toggle("is-err", kind === "err");
  }

  function nextUrl() {
    const params = new URLSearchParams(location.search);
    const next = String(params.get("next") || "admin.html").replace(/[^a-z0-9._-]/gi, "");
    if (!next || next === "login.html") return "admin.html";
    return next;
  }

  function attempt() {
    if (!window.SitePin) {
      setBanner("PIN lock failed to load.", "err");
      return;
    }
    if (!window.SitePin.configuredPin()) {
      setBanner("Set sitePin (4 digits) in js/config.js.", "err");
      return;
    }
    const result = window.SitePin.verify(input.value);
    if (result.ok) {
      setBanner("Unlocked.", "ok");
      location.replace(nextUrl());
      return;
    }
    if (result.reason === "locked") {
      const secs = Math.ceil((result.remainingMs || 0) / 1000);
      setBanner(`Too many attempts. Try again in ${secs}s.`, "err");
      return;
    }
    if (result.reason === "not_configured") {
      setBanner("Set sitePin (4 digits) in js/config.js.", "err");
      return;
    }
    input.value = "";
    input.focus();
    setBanner("Incorrect PIN.", "err");
  }

  function setDigits(next) {
    input.value = String(next || "").replace(/\D/g, "").slice(0, 4);
    if (input.value.length === 4) attempt();
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.SitePin?.requireUnlock?.();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      attempt();
    });

    input?.addEventListener("input", () => {
      input.value = String(input.value || "").replace(/\D/g, "").slice(0, 4);
      if (input.value.length === 4) attempt();
    });

    document.querySelectorAll(".pin-key").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-key");
        if (key === "clear") {
          setDigits("");
          return;
        }
        if (key === "del") {
          setDigits(String(input.value || "").slice(0, -1));
          return;
        }
        setDigits(String(input.value || "") + key);
      });
    });

    submit?.addEventListener("click", (e) => {
      e.preventDefault();
      attempt();
    });

    input?.focus();
  });
})();
