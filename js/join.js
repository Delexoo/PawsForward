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
    name: document.getElementById("join-name"),
    email: document.getElementById("join-email"),
    phone: document.getElementById("join-phone"),
    payment: document.getElementById("join-payment"),
    handle: document.getElementById("join-handle"),
    errName: document.getElementById("err-join-name"),
    errEmail: document.getElementById("err-join-email"),
    errPhone: document.getElementById("err-join-phone"),
    errPayment: document.getElementById("err-join-payment"),
    errHandle: document.getElementById("err-join-handle"),
    age: document.getElementById("join-age"),
    errAge: document.getElementById("err-join-age"),
  };

  let current = { url: "", name: "", code: "", email: "", phone: "", qrPage: "" };

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
    setFieldError(els.errName, "");
    setFieldError(els.errEmail, "");
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

  function functionsBase() {
    const url = String(window.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function anonKey() {
    return String(window.SITE_CONFIG?.supabaseAnonKey || "");
  }

  function isEmail(value) {
    const email = String(value || "").trim();
    return email.length >= 5 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function emailWelcome() {
    const base = functionsBase();
    if (!base || !current.email || !current.code) {
      return { ok: false, error: "Email is not ready yet." };
    }
    try {
      const res = await fetch(`${base}/send-promoter-welcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
          Authorization: "Bearer " + anonKey(),
        },
        body: JSON.stringify({
          email: current.email,
          referral_code: current.code,
          share_url: current.url,
          qr_page_url: current.qrPage,
          site_origin: siteOrigin(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not send email.");
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, error: err?.message || "Could not send email." };
    }
  }

  function readForm() {
    return {
      name: String(els.name?.value || "").trim(),
      email: String(els.email?.value || "").trim().toLowerCase(),
      phone: formatPhoneDisplay(els.phone?.value || "").trim(),
      payment_type: String(els.payment?.value || "").trim(),
      payment_handle: normalizeHandle(els.handle?.value),
    };
  }

  function validate(payload) {
    clearErrors();
    let bad = false;
    if (!payload.name) {
      setFieldError(els.errName, "Enter your name.");
      bad = true;
    } else if (payload.name.length > 80) {
      setFieldError(els.errName, "Name is too long.");
      bad = true;
    }
    if (!isEmail(payload.email)) {
      setFieldError(els.errEmail, "Enter a valid email.");
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

  async function showSuccess(row, email, phone) {
    const name = cleanName(row.first_name) || "promoter";
    const url = shareUrlFor(row.referral_code);
    const code = row.referral_code || "";
    const qrPage = qrPageUrlFor(code);
    current = {
      url,
      name,
      code,
      email: String(email || row.email || "").trim().toLowerCase(),
      phone: phone || "",
      qrPage,
    };

    if (els.form) els.form.hidden = true;
    if (els.success) els.success.hidden = false;
    if (els.successTitle) {
      els.successTitle.textContent = name ? `You’re in, ${name}` : "You’re in";
    }
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.code) els.code.textContent = code || "—";

    const msg = welcomeMessage(name, url, code || "—", qrPage);
    if (els.successMsg) els.successMsg.textContent = msg;
    if (els.successLead) {
      els.successLead.textContent = `We’re emailing ${current.email || "you"} your link and QR.`;
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

    setBanner("Emailing your QR…");
    const mailed = await emailWelcome();
    if (mailed.ok) {
      setBanner(`Sent to ${current.email}. Check your inbox (and spam).`, "ok");
      if (els.successLead) {
        els.successLead.textContent = "We emailed your link and QR. Save a copy here too.";
      }
    } else {
      setBanner(mailed.error || "Account created — download your QR below while email is set up.", "err");
      if (els.successLead) {
        els.successLead.textContent =
          "Here’s your link and QR — use Download, or tap Resend email once mail is ready.";
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

    const { data, error } = await sb.rpc("public_signup_promoter", {
      p_first_name: payload.name,
      p_last_name: "",
      p_phone: payload.phone,
      p_payment_type: payload.payment_type,
      p_payment_handle: payload.payment_handle,
      p_email: payload.email,
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

    await showSuccess(row, payload.email, payload.phone);
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
      setBanner("Resending email…");
      const mailed = await emailWelcome();
      if (mailed.ok) {
        setBanner(`Sent again to ${current.email}.`, "ok");
      } else {
        setBanner(mailed.error || "Could not resend email.", "err");
      }
    });
  });
})();
