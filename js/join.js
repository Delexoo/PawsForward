(function () {
  const els = {
    banner: document.getElementById("status-banner"),
    form: document.getElementById("join-form"),
    submit: document.getElementById("join-submit"),
    success: document.getElementById("join-success"),
    successTitle: document.getElementById("join-success-title"),
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

  let current = { url: "", name: "", code: "", phone: "", qrPage: "" };

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

  function siteOrigin() {
    return String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  }

  function shareUrlFor(code) {
    // QR / share link opens Stripe Checkout directly (Edge redirects 303).
    if (typeof window.SITE_CONFIG?.checkoutUrl === "function") {
      return window.SITE_CONFIG.checkoutUrl(code);
    }
    const origin = siteOrigin();
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/donate?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/donate?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/donate` : new URL("/donate", location.origin).href;
  }

  function qrPageUrlFor(code) {
    const origin = siteOrigin();
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/qr?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/qr?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/qr` : new URL("/qr", location.origin).href;
  }

  function toE164(phone) {
    let d = String(phone || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    if (d.length === 10) return `+1${d}`;
    if (d.length >= 11 && d.length <= 15) return `+${d}`;
    return "";
  }

  function welcomeMessage(first, url, code, qrPage) {
    const who = first || "there";
    const page = qrPage || url;
    return (
      `Hi ${who} — you’re in at Paws Forward!\n\n` +
      `Your donation link:\n${url}\n\n` +
      `Your QR (open & save):\n${page}\n\n` +
      `Code: ${code}\n` +
      `Share the link or QR — gifts through them count toward your payout.`
    );
  }

  async function qrPngFile(url, code) {
    const dataUrl = await window.PfQr.toDataURL(url, 512);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], `pawsforward-${code || "qr"}.png`, { type: "image/png" });
  }

  /** Open the phone's Messages app with a draft to their number (no Twilio). */
  function openSmsDraft(phone, body) {
    const to = toE164(phone);
    if (!to || !body) return false;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    const href = ios
      ? `sms:${to}&body=${encodeURIComponent(body)}`
      : `sms:${to}?body=${encodeURIComponent(body)}`;
    const a = document.createElement("a");
    a.href = href;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  async function deliverQr(phone) {
    const text = welcomeMessage(current.name, current.url, current.code || "—", current.qrPage);
    let sharedFile = false;

    try {
      const file = await qrPngFile(current.url, current.code);
      window.PfQr.downloadDataUrl(await window.PfQr.toDataURL(current.url, 512), file.name);

      if (navigator.share && navigator.canShare) {
        const withFile = { title: "Paws Forward QR", text, files: [file] };
        if (navigator.canShare(withFile)) {
          await navigator.share(withFile);
          sharedFile = true;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        // User closed the share sheet — still offer the SMS draft below.
      } else {
        console.warn(err);
        try {
          const dataUrl = await window.PfQr.toDataURL(current.url, 512);
          window.PfQr.downloadDataUrl(dataUrl, `pawsforward-${current.code || "qr"}.png`);
        } catch {
          /* ignore */
        }
      }
    }

    // Draft a text to their own number with link + QR page (they tap Send).
    const drafted = openSmsDraft(phone, text);
    return { sharedFile, drafted };
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
    if (payload.first_name && payload.first_name.length > 80) {
      setFieldError(els.errFirst, "First name is too long.");
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

  function cleanName(value) {
    return String(value || "").replace(/\u00A0/g, " ").trim();
  }

  async function showSuccess(row, phone) {
    const first = cleanName(row.first_name);
    const last = cleanName(row.last_name);
    const name = `${first} ${last}`.trim() || "promoter";
    const url = shareUrlFor(row.referral_code);
    const code = row.referral_code || "";
    const qrPage = qrPageUrlFor(code);
    current = { url, name, code, phone: phone || "", qrPage };

    if (els.form) els.form.hidden = true;
    if (els.success) els.success.hidden = false;
    if (els.successTitle) {
      els.successTitle.textContent = first ? `You’re in, ${first}` : "You’re in";
    }
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.code) els.code.textContent = code || "—";

    const msg = welcomeMessage(first, url, code || "—", qrPage);
    if (els.successMsg) els.successMsg.textContent = msg;
    if (els.successLead) {
      els.successLead.textContent =
        "We’re sending your QR to your phone’s Messages app — tap Send. A PNG download starts too.";
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
    } catch {
      /* optional */
    }

    setBanner("Preparing your QR…");
    const result = await deliverQr(phone);
    if (result.drafted && result.sharedFile) {
      setBanner("QR downloaded + share opened. Also check Messages — tap Send to keep it.", "ok");
    } else if (result.drafted) {
      setBanner("QR downloaded. Messages should open with your link & QR page — tap Send.", "ok");
    } else if (result.sharedFile) {
      setBanner("QR shared / downloaded. Save it somewhere you can find it.", "ok");
    } else {
      setBanner("You’re set — download or share your QR below.", "ok");
      if (els.successLead) {
        els.successLead.textContent =
          "Here’s your link and QR — use Download or Send to my phone.";
      }
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

    // Empty first name → NBSP so older signup RPCs that still require a name succeed;
    // UI trims it back to blank. New RPC accepts '' and stores ''.
    const { data, error } = await sb.rpc("public_signup_promoter", {
      p_first_name: payload.first_name || "\u00A0",
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

    await showSuccess(row, payload.phone);
  }

  function enhanceSelect(select) {
    if (!select || select.dataset.pfSelect === "1") return;
    if (window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(hover: hover)").matches) {
      return;
    }

    select.dataset.pfSelect = "1";
    const wrap = document.createElement("div");
    wrap.className = "pf-select";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add("pf-select-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "pf-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.id = `${select.id}-trigger`;

    const menu = document.createElement("ul");
    menu.className = "pf-select-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    menu.id = `${select.id}-menu`;
    trigger.setAttribute("aria-controls", menu.id);

    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) {
      label.removeAttribute("for");
      label.id = label.id || `${select.id}-label`;
      trigger.setAttribute("aria-labelledby", label.id);
      label.addEventListener("click", (e) => {
        e.preventDefault();
        trigger.focus();
        open();
      });
    }

    const options = [...select.options].filter((opt) => !opt.disabled || opt.value === "");
    let activeIndex = -1;

    function selectedOption() {
      return select.options[select.selectedIndex] || null;
    }

    function syncTrigger() {
      const opt = selectedOption();
      const empty = !opt || !opt.value;
      trigger.textContent = empty ? (select.options[0]?.textContent || "Choose one") : opt.textContent;
      trigger.classList.toggle("is-placeholder", empty);
      [...menu.querySelectorAll(".pf-select-option")].forEach((btn) => {
        const on = btn.dataset.value === select.value;
        btn.classList.toggle("is-selected", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function setActive(index) {
      const buttons = [...menu.querySelectorAll(".pf-select-option:not(:disabled)")];
      if (!buttons.length) return;
      activeIndex = (index + buttons.length) % buttons.length;
      buttons.forEach((btn, i) => btn.classList.toggle("is-active", i === activeIndex));
      buttons[activeIndex]?.scrollIntoView({ block: "nearest" });
    }

    function close() {
      wrap.classList.remove("is-open");
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      activeIndex = -1;
      [...menu.querySelectorAll(".pf-select-option")].forEach((btn) => btn.classList.remove("is-active"));
    }

    function open() {
      wrap.classList.add("is-open");
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      const buttons = [...menu.querySelectorAll(".pf-select-option:not(:disabled)")];
      const selected = buttons.findIndex((btn) => btn.dataset.value === select.value);
      setActive(selected >= 0 ? selected : 0);
    }

    function choose(value) {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
      }
      syncTrigger();
      close();
      trigger.focus();
    }

    options.forEach((opt) => {
      if (!opt.value && opt.disabled) return;
      const li = document.createElement("li");
      li.setAttribute("role", "presentation");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pf-select-option";
      btn.setAttribute("role", "option");
      btn.dataset.value = opt.value;
      btn.textContent = opt.textContent;
      if (!opt.value) {
        btn.disabled = true;
        btn.textContent = opt.textContent;
      }
      btn.addEventListener("click", () => {
        if (!opt.value) return;
        choose(opt.value);
      });
      li.appendChild(btn);
      menu.appendChild(li);
    });

    trigger.addEventListener("click", () => {
      if (menu.hidden) open();
      else close();
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (menu.hidden) open();
        else if (e.key === "ArrowDown") setActive(activeIndex + 1);
        else if (e.key === "Enter" || e.key === " ") {
          const buttons = [...menu.querySelectorAll(".pf-select-option:not(:disabled)")];
          const btn = buttons[activeIndex];
          if (btn) choose(btn.dataset.value);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (menu.hidden) open();
        else setActive(activeIndex - 1);
      } else if (e.key === "Escape") {
        close();
      }
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) close();
    });

    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    syncTrigger();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const rate = Number(window.SITE_CONFIG?.commissionRate ?? 0.5);
    if (els.commission && Number.isFinite(rate)) {
      els.commission.textContent = `${Math.round(rate * 100)}%`;
    }

    enhanceSelect(els.payment);
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
      setBanner("Opening send options…");
      const result = await deliverQr(current.phone);
      if (result.drafted || result.sharedFile) {
        setBanner("Use Messages or the share sheet to save your QR.", "ok");
      } else {
        setBanner("Could not open Messages — download your QR instead.", "err");
      }
    });
  });
})();
