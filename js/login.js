(function () {
  const form = document.getElementById("login-form");
  const banner = document.getElementById("status-banner");
  const submit = document.getElementById("login-submit");
  const emailEl = document.getElementById("login-email");
  const passEl = document.getElementById("login-password");
  const errEmail = document.getElementById("err-email");
  const errPass = document.getElementById("err-password");

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

  function setFieldError(el, msg) {
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const gate = await window.SiteSupabase.requireAdminSession();
    if (gate.ok) {
      window.location.replace("admin.html");
      return;
    }

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setFieldError(errEmail, "");
      setFieldError(errPass, "");
      setBanner("");

      const email = String(emailEl.value || "").trim();
      const password = String(passEl.value || "");
      let bad = false;
      if (!email || !email.includes("@")) {
        setFieldError(errEmail, "Enter a valid email.");
        bad = true;
      }
      if (!password || password.length < 8) {
        setFieldError(errPass, "Password must be at least 8 characters.");
        bad = true;
      }
      if (bad) return;

      const sb = window.SiteSupabase.getClient();
      if (!sb) {
        setBanner("Supabase is not configured.", "err");
        return;
      }

      submit.disabled = true;
      setBanner("Signing in…");
      const { error } = await sb.auth.signInWithPassword({ email, password });
      submit.disabled = false;

      if (error) {
        // Same message whether or not the email exists.
        setBanner("Could not sign in. Check your email and password.", "err");
        return;
      }

      window.location.replace("admin.html");
    });
  });
})();
