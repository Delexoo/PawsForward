(function () {
  const els = {
    banner: document.getElementById("status-banner"),
    form: document.getElementById("join-form"),
    submit: document.getElementById("join-submit"),
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

  function isLocalHost() {
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function siteOrigin() {
    // Local preview should keep QR/donate links on this machine.
    if (isLocalHost()) return location.origin.replace(/\/$/, "");
    return String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  }

  function shareUrlFor(code) {
    // Short public donate URL (donate page sends people to Stripe).
    const origin = siteOrigin() || location.origin.replace(/\/$/, "");
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/donate?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/donate?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/donate` : new URL("/donate", location.origin).href;
  }

  function qrPageUrlFor(code) {
    const origin = siteOrigin() || location.origin.replace(/\/$/, "");
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/qr?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/qr?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/qr` : new URL("/qr", location.origin).href;
  }

  function isEmail(value) {
    const email = String(value || "").trim();
    return email.length >= 5 && email.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function phoneDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function readForm() {
    const phoneFormatted = formatPhoneDisplay(els.phone?.value || "").trim();
    const digits = phoneDigits(phoneFormatted);
    return {
      name: String(els.name?.value || "").trim(),
      email: String(els.email?.value || "").trim().toLowerCase(),
      // Optional — blank / punctuation-only counts as no phone.
      phone: digits ? phoneFormatted : "",
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
    if (payload.phone) {
      const digits = phoneDigits(payload.phone);
      if (digits.length < 10 || digits.length > 15 || payload.phone.length > 40) {
        setFieldError(els.errPhone, "Enter a valid phone number.");
        bad = true;
      }
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

  function openCreatedPage(row, payload) {
    const code = String(row.referral_code || "").trim();
    const record = {
      name: cleanName(row.first_name) || cleanName(payload.name),
      email: String(payload.email || row.email || "").trim().toLowerCase(),
      phone: String(payload.phone || "").trim(),
      paymentType: String(row.payment_type || payload.payment_type || "").trim(),
      paymentHandle: String(row.payment_handle || payload.payment_handle || "").trim(),
      code,
      url: shareUrlFor(code),
      qrPage: qrPageUrlFor(code),
    };
    try {
      sessionStorage.setItem("pf-created-qr", JSON.stringify(record));
      sessionStorage.setItem("pf-nav", "1");
    } catch (err) {
      console.error(err);
    }
    location.assign(`/created?ref=${encodeURIComponent(code)}`);
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

    const argsWithEmail = {
      p_first_name: payload.name,
      p_last_name: "-",
      p_phone: payload.phone || null,
      p_payment_type: payload.payment_type,
      p_payment_handle: payload.payment_handle,
      p_email: payload.email,
    };
    const argsWithoutEmail = {
      p_first_name: payload.name,
      p_last_name: "-",
      p_phone: payload.phone || null,
      p_payment_type: payload.payment_type,
      p_payment_handle: payload.payment_handle,
    };

    let { data, error } = await sb.rpc("public_signup_promoter", argsWithEmail);
    if (
      error &&
      /Could not find the function|PGRST202|schema cache|p_email/i.test(
        String(error.message || error.code || error.details || "")
      )
    ) {
      ({ data, error } = await sb.rpc("public_signup_promoter", argsWithoutEmail));
    }

    if (els.submit) els.submit.disabled = false;

    if (error) {
      console.error(error);
      const raw = String(error.message || "");
      if (/load failed|failed to fetch|networkerror/i.test(raw)) {
        setBanner("Network error — check your connection and try again.", "err");
        return;
      }
      const limitHit = /hit the limit|over 5 QR|already created over 5/i.test(raw);
      setBanner(
        limitHit
          ? "You've already created over 5 QR codes with these details. You've hit the limit."
          : raw || "Could not create your profile.",
        "err"
      );
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.referral_code) {
      setBanner("Signup succeeded but no referral code came back.", "err");
      return;
    }

    openCreatedPage(row, payload);
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
  });
})();
