(function () {
  "use strict";

  const form = document.getElementById("signin-form");
  const emailInput = document.getElementById("signin-email");
  const codeWrap = document.getElementById("signin-code-wrap");
  const codeInput = document.getElementById("signin-code");
  const submit = document.getElementById("signin-submit");
  const banner = document.getElementById("status-banner");
  const errEmail = document.getElementById("err-signin-email");
  const errCode = document.getElementById("err-signin-code");

  function setBanner(msg, kind) {
    if (!banner) return;
    banner.hidden = !msg;
    banner.textContent = msg || "";
    banner.classList.toggle("is-ok", kind === "ok");
    banner.classList.toggle("is-err", kind === "err");
  }

  function setFieldError(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function validEmail(value) {
    const email = String(value || "").trim().toLowerCase();
    return email.length >= 5 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function goIfSignedIn() {
    const sb = window.PfPromoter?.getClient?.();
    const { data } = (await sb?.auth.getSession()) || {};
    if (data?.session) location.replace("/account");
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(emailInput?.value || "").trim().toLowerCase();
    const code = String(codeInput?.value || "").replace(/\D/g, "");
    setFieldError(errEmail, "");
    setFieldError(errCode, "");
    if (!validEmail(email)) {
      setFieldError(errEmail, "Enter the email you used for your QR.");
      return;
    }
    if (submit) submit.disabled = true;
    try {
      if (codeWrap && !codeWrap.hidden) {
        if (code.length < 6) {
          setFieldError(errCode, "Enter the 6-digit code from the email.");
          return;
        }
        const verified = await window.PfPromoter.verifyCode(email, code);
        if (!verified.ok) {
          setBanner("That code didn’t work. Request a new email and try again.", "err");
          return;
        }
        location.replace("/account");
        return;
      }
      setBanner("Sending your sign-in email…");
      const sent = await window.PfPromoter.requestLink(email);
      if (!sent.ok) {
        setBanner(sent.error || "Could not send the sign-in email.", "err");
        return;
      }
      if (codeWrap) codeWrap.hidden = false;
      if (codeInput) codeInput.focus();
      if (submit) submit.textContent = "Verify and sign in";
      setBanner("If that email has a QR, we sent a sign-in link and a code. Check your inbox.", "ok");
    } catch (err) {
      console.error(err);
      setBanner("Could not sign you in. Try again.", "err");
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const finished = await window.PfPromoter?.finishLink?.();
    if (finished?.ok) {
      location.replace("/account");
      return;
    }
    if (finished && !finished.skipped && !finished.ok) {
      setBanner("That sign-in link expired. Enter your email and we’ll send a new one.", "err");
    }
    await goIfSignedIn();
  });
})();
