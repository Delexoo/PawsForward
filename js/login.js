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
    input.value = "";
    document.querySelectorAll("#pin-dots i").forEach((dot) => dot.classList.remove("is-on"));
    setBanner(result.message || "Incorrect PIN.");
  }

  document.addEventListener("DOMContentLoaded", () => {
    window.SitePin?.requireUnlock?.();

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      attempt();
    });

    const dots = [...document.querySelectorAll("#pin-dots i")];

    function digits() {
      return String(input?.value || "").replace(/\D/g, "").slice(0, 4);
    }

    function paint(next) {
      const value = String(next ?? digits()).replace(/\D/g, "").slice(0, 4);
      if (input && input.value !== value) input.value = value;
      dots.forEach((dot, index) => dot.classList.toggle("is-on", index < value.length));
      return value;
    }

    function pushDigit(digit) {
      if (busy) return;
      setBanner("");
      const value = paint(digits() + digit);
      if (value.length === 4) attempt();
    }

    function popDigit() {
      if (busy) return;
      setBanner("");
      paint(digits().slice(0, -1));
    }

    document.querySelectorAll("[data-digit]").forEach((button) => {
      button.addEventListener("click", () => pushDigit(button.getAttribute("data-digit") || ""));
    });
    document.querySelector("[data-pin='delete']")?.addEventListener("click", popDigit);
    document.querySelector("[data-pin='clear']")?.addEventListener("click", () => {
      if (busy) return;
      setBanner("");
      paint("");
    });

    document.addEventListener("keydown", (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && target !== input && target.closest && target.closest("input, textarea")) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        pushDigit(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        popDigit();
      }
    });

    const remaining = window.SitePin?.lockoutRemainingMs?.() || 0;
    if (remaining > 0) {
      setBanner(`Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`);
    }
    paint("");
  });
})();
