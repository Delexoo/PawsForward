(function () {
  "use strict";

  const form = document.getElementById("signin-form");
  const emailInput = document.getElementById("signin-email");
  const codeWrap = document.getElementById("signin-code-wrap");
  const codeInput = document.getElementById("signin-code");
  const submit = document.getElementById("signin-submit");
  const resend = document.getElementById("signin-resend");
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

  function currentEmail() {
    return String(emailInput?.value || "").trim().toLowerCase();
  }

  async function goIfSignedIn() {
    const sb = window.PfPromoter?.getClient?.();
    const { data } = (await sb?.auth.getSession()) || {};
    if (data?.session) location.replace("/account");
  }

  function showCodeStep() {
    if (codeWrap) codeWrap.hidden = false;
    if (resend) resend.hidden = false;
    if (submit) submit.textContent = "Verify and sign in";
    if (codeInput) codeInput.focus();
  }

  async function sendCode(email) {
    setBanner("Sending your code…");
    const sent = await window.PfPromoter.requestLink(email);
    if (!sent.ok) {
      setBanner(sent.error || "Could not send the code.", "err");
      return false;
    }
    showCodeStep();
    setBanner("If that email has a QR, we sent a code. Enter it below.", "ok");
    return true;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = currentEmail();
    const code = String(codeInput?.value || "").replace(/\D/g, "");
    setFieldError(errEmail, "");
    setFieldError(errCode, "");
    if (!validEmail(email)) {
      setFieldError(errEmail, "Enter the email you used for your QR.");
      return;
    }
    if (submit) submit.disabled = true;
    if (resend) resend.disabled = true;
    try {
      if (codeWrap && !codeWrap.hidden) {
        if (code.length < 6) {
          setFieldError(errCode, "Enter the 6-digit code from the email.");
          return;
        }
        const verified = await window.PfPromoter.verifyCode(email, code);
        if (!verified.ok) {
          setBanner("That code didn’t work. Resend the code and try again.", "err");
          return;
        }
        location.replace("/account");
        return;
      }
      await sendCode(email);
    } catch (err) {
      console.error(err);
      setBanner("Could not sign you in. Try again.", "err");
    } finally {
      if (submit) submit.disabled = false;
      if (resend) resend.disabled = false;
    }
  });

  resend?.addEventListener("click", async () => {
    const email = currentEmail();
    setFieldError(errEmail, "");
    if (!validEmail(email)) {
      setFieldError(errEmail, "Enter the email you used for your QR.");
      return;
    }
    if (submit) submit.disabled = true;
    resend.disabled = true;
    try {
      await sendCode(email);
    } catch (err) {
      console.error(err);
      setBanner("Could not resend the code. Try again.", "err");
    } finally {
      if (submit) submit.disabled = false;
      resend.disabled = false;
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const finished = await window.PfPromoter?.finishLink?.();
    if (finished?.ok) {
      location.replace("/account");
      return;
    }
    if (finished && !finished.skipped && !finished.ok) {
      setBanner("That sign-in link expired. Enter your email and we’ll send a code.", "err");
    }
    await goIfSignedIn();
  });
})();
