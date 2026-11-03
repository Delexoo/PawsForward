(function () {
  const els = {
    banner: document.getElementById("status-banner"),
    form: document.getElementById("join-form"),
    submit: document.getElementById("join-submit"),
    success: document.getElementById("join-success"),
    successName: document.getElementById("join-success-name"),
    successLead: document.getElementById("join-success-lead"),
    qr: document.getElementById("join-qr"),
    shareUrl: document.getElementById("join-share-url"),
    code: document.getElementById("join-code"),
    copy: document.getElementById("join-copy"),
    download: document.getElementById("join-download"),
    commission: document.getElementById("join-commission"),
    first: document.getElementById("join-first"),
    last: document.getElementById("join-last"),
    phone: document.getElementById("join-phone"),
    payment: document.getElementById("join-payment"),
    handle: document.getElementById("join-handle"),
    errFirst: document.getElementById("err-join-first"),
    errLast: document.getElementById("err-join-last"),
    errPhone: document.getElementById("err-join-phone"),
    errPayment: document.getElementById("err-join-payment"),
    errHandle: document.getElementById("err-join-handle"),
  };

  let current = { url: "", name: "", code: "" };

  function setBanner(msg, kind) {
    if (!els.banner) return;
    if (!msg) {
      els.banner.hidden = true;
      els.banner.textContent = "";
      els.banner.classList.remove("is-ok", "is-err");
      return;
    }
    els.banner.hidden = false;
    els.banner.textContent = msg;
    els.banner.classList.toggle("is-ok", kind === "ok");
    els.banner.classList.toggle("is-err", kind === "err");
  }

  function setFieldError(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function clearErrors() {
    setFieldError(els.errFirst, "");
    setFieldError(els.errLast, "");
    setFieldError(els.errPhone, "");
    setFieldError(els.errPayment, "");
    setFieldError(els.errHandle, "");
  }

  function normalizeHandle(raw) {
    return String(raw || "").trim().replace(/\s+/g, " ");
  }

  function shareUrlFor(code) {
    const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/r/${encodeURIComponent(ref)}`;
    if (ref) return new URL(`r/${encodeURIComponent(ref)}`, location.href).href;
    return origin || location.origin;
  }

  function readForm() {
    return {
      first_name: String(els.first?.value || "").trim(),
      last_name: String(els.last?.value || "").trim(),
      phone: String(els.phone?.value || "").trim(),
      payment_type: String(els.payment?.value || "").trim(),
      payment_handle: normalizeHandle(els.handle?.value),
    };
  }

  function validate(payload) {
    clearErrors();
    let bad = false;
    if (!payload.first_name) {
      setFieldError(els.errFirst, "Enter a first name.");
      bad = true;
    }
    if (!payload.last_name) {
      setFieldError(els.errLast, "Enter a last name.");
      bad = true;
    }
    if (!payload.phone || payload.phone.length < 7) {
      setFieldError(els.errPhone, "Enter a valid phone number.");
      bad = true;
    }
    if (!payload.payment_type) {
      setFieldError(els.errPayment, "Choose a payout type.");
      bad = true;
    }
    if (!payload.payment_handle) {
      setFieldError(els.errHandle, "Enter a payout handle.");
      bad = true;
    }
    return !bad;
  }

  async function showSuccess(row) {
    const name = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "promoter";
    const url = shareUrlFor(row.referral_code);
    current = { url, name, code: row.referral_code || "" };

    if (els.form) els.form.hidden = true;
    if (els.success) els.success.hidden = false;
    if (els.successName) els.successName.textContent = row.first_name || name;
    if (els.successLead) {
      els.successLead.textContent =
        "Share this QR or link. Donations through it are attributed to you at the promoter rate.";
    }
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.code) els.code.textContent = row.referral_code || "—";

    try {
      await window.PfQr.renderInto(els.qr, url, 220);
    } catch (err) {
      console.error(err);
      setBanner("Account created, but the QR could not render. Copy your link below.", "err");
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const payload = readForm();
    if (!validate(payload)) return;

    const sb = window.SiteSupabase?.getClient?.();
    if (!sb) {
      setBanner("Signup is not configured right now.", "err");
      return;
    }

    if (els.submit) els.submit.disabled = true;
    setBanner("Creating your QR…");

    const { data, error } = await sb.rpc("public_signup_promoter", {
      p_first_name: payload.first_name,
      p_last_name: payload.last_name,
      p_phone: payload.phone,
      p_payment_type: payload.payment_type,
      p_payment_handle: payload.payment_handle,
    });

    if (els.submit) els.submit.disabled = false;

    if (error) {
      console.error(error);
      setBanner(error.message || "Could not create your profile.", "err");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.referral_code) {
      setBanner("Signup succeeded but no referral code came back.", "err");
      return;
    }

    setBanner("You’re set — save your QR below.", "ok");
    await showSuccess(row);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const rate = Number(window.SITE_CONFIG?.commissionRate ?? 0.25);
    if (els.commission && Number.isFinite(rate)) {
      els.commission.textContent = `${Math.round(rate * 100)}%`;
    }

    els.form?.addEventListener("submit", onSubmit);
    els.copy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(current.url);
        setBanner("Link copied.", "ok");
      } catch {
        els.shareUrl?.select();
        setBanner("Could not copy automatically — select and copy the link.", "err");
      }
    });
    els.download?.addEventListener("click", async () => {
      try {
        const dataUrl = await window.PfQr.toDataURL(current.url, 512);
        window.PfQr.downloadDataUrl(dataUrl, `pawsforward-${current.code || "qr"}.png`);
      } catch (err) {
        console.error(err);
        setBanner("Could not download QR.", "err");
      }
    });
  });
})();
