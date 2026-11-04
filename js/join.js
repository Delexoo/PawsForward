(function () {
  const els = {
    banner: document.getElementById("status-banner"),
    form: document.getElementById("join-form"),
    submit: document.getElementById("join-submit"),
    success: document.getElementById("join-success"),
    successName: document.getElementById("join-success-name"),
    successLead: document.getElementById("join-success-lead"),
    successMsg: document.getElementById("join-success-msg"),
    qr: document.getElementById("join-qr"),
    shareUrl: document.getElementById("join-share-url"),
    code: document.getElementById("join-code"),
    copy: document.getElementById("join-copy"),
    download: document.getElementById("join-download"),
    share: document.getElementById("join-share"),
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
    age: document.getElementById("join-age"),
    errAge: document.getElementById("err-join-age"),
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
    setFieldError(els.errAge, "");
  }

  function normalizeHandle(raw) {
    return String(raw || "").trim().replace(/\s+/g, " ");
  }

  /** Format US numbers as (555) 123-4567 while typing. */
  function formatPhoneDisplay(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (!digits) return "";
    if (digits.length < 4) return `(${digits}`;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function applyPhoneInputFormat(input) {
    if (!input) return;
    const formatted = formatPhoneDisplay(input.value);
    if (input.value === formatted) return;
    const wasEnd = input.selectionStart === input.value.length;
    input.value = formatted;
    if (wasEnd) {
      try {
        input.setSelectionRange(formatted.length, formatted.length);
      } catch {
        /* ignore */
      }
    }
  }

  function shareUrlFor(code) {
    const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
    const ref = String(code || "").trim();
    // Point QR straight at donate (no /r/ hop) so scanners don't see a redirect.
    if (origin && ref) return `${origin}/donate.html?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`donate.html?ref=${encodeURIComponent(ref)}`, location.href).href;
    return origin ? `${origin}/donate.html` : new URL("donate.html", location.href).href;
  }

  function readForm() {
    return {
      first_name: String(els.first?.value || "").trim(),
      last_name: String(els.last?.value || "").trim(),
      phone: formatPhoneDisplay(els.phone?.value || "").trim(),
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
    if (payload.last_name && payload.last_name.length > 80) {
      setFieldError(els.errLast, "Last name is too long.");
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
    if (!els.age?.checked) {
      setFieldError(els.errAge, "Confirm you are old enough to join.");
      bad = true;
    }
    return !bad;
  }

  function welcomeMessage(first, url, code) {
    const who = first || "there";
    return (
      `Hi ${who} — you’re in at Paws Forward!\n\n` +
      `Your donation link:\n${url}\n\n` +
      `Your code: ${code}\n` +
      `Save the QR on this page (screenshot or Download). Share either the link or the QR — gifts through them count toward your payout.`
    );
  }

  async function showSuccess(row) {
    const name = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "promoter";
    const url = shareUrlFor(row.referral_code);
    const code = row.referral_code || "";
    current = { url, name, code };

    if (els.form) els.form.hidden = true;
    if (els.success) els.success.hidden = false;
    if (els.successName) els.successName.textContent = row.first_name || name;
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.code) els.code.textContent = code || "—";

    const msg = welcomeMessage(row.first_name || name, url, code || "—");
    if (els.successMsg) els.successMsg.textContent = msg;
    if (els.successLead) {
      els.successLead.textContent =
        "Here’s your link and QR — save them now. Donations through either are attributed to you.";
    }

    try {
      await window.PfQr.renderInto(els.qr, url, 220);
    } catch (err) {
      console.error(err);
      setBanner("Account created, but the QR could not render. Copy your link below.", "err");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setBanner("You’re set — link copied. Your QR is below.", "ok");
    } catch {
      setBanner("You’re set — save your link and QR below.", "ok");
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

    await showSuccess(row);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const rate = Number(window.SITE_CONFIG?.commissionRate ?? 0.5);
    if (els.commission && Number.isFinite(rate)) {
      els.commission.textContent = `${Math.round(rate * 100)}%`;
    }

    els.form?.addEventListener("submit", onSubmit);
    els.phone?.addEventListener("input", () => applyPhoneInputFormat(els.phone));
    if (els.phone?.value) applyPhoneInputFormat(els.phone);
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
    els.share?.addEventListener("click", async () => {
      const text = welcomeMessage(current.name, current.url, current.code || "—");
      try {
        if (navigator.share) {
          const data = { title: "Paws Forward", text, url: current.url };
          if (navigator.canShare && !navigator.canShare(data)) {
            await navigator.share({ title: "Paws Forward", text: current.url });
          } else {
            await navigator.share(data);
          }
          setBanner("Shared.", "ok");
          return;
        }
        await navigator.clipboard.writeText(text);
        setBanner("Message copied — paste it anywhere you want to save it.", "ok");
      } catch (err) {
        if (err && err.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(text);
          setBanner("Message copied — paste it anywhere you want to save it.", "ok");
        } catch {
          setBanner("Could not share automatically — copy your link below.", "err");
        }
      }
    });
  });
})();
