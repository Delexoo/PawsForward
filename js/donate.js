(function () {
  const CONSENT_KEY = "pf_visit_consent_v1";

  const els = {
    banner: document.getElementById("status-banner"),
    consent: document.getElementById("consent-banner"),
    consentAccept: document.getElementById("consent-accept"),
    consentRefuse: document.getElementById("consent-refuse"),
    lead: document.getElementById("donate-lead"),
    formWrap: document.getElementById("donate-form-wrap"),
    form: document.getElementById("donate-form"),
    amount: document.getElementById("donate-amount"),
    name: document.getElementById("donate-name"),
    errAmount: document.getElementById("err-amount"),
    errName: document.getElementById("err-name"),
    submit: document.getElementById("donate-submit"),
    success: document.getElementById("donate-success"),
    successMsg: document.getElementById("donate-success-msg"),
    again: document.getElementById("donate-again"),
  };

  const state = { code: "", employee: null };

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

  function money(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  }

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
  }

  async function resolveEmployee(sb, code) {
    if (!code) return null;
    const { data, error } = await sb.rpc("resolve_employee_by_code", { p_code: code });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  }

  async function fetchGeo() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch("https://ipapi.co/json/", { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return {};
      const json = await res.json();
      return {
        city: json.city || null,
        region: json.region || json.region_code || null,
        country: json.country_name || json.country || null,
      };
    } catch {
      return {};
    }
  }

  async function logVisit(sb) {
    if (getConsent() !== "accepted") return;
    const geo = await fetchGeo();
    const { error } = await sb.rpc("record_visit", {
      p_referral_code: state.code || null,
      p_employee_id: state.employee?.id || null,
      p_path: window.location.pathname + window.location.search,
      p_city: geo.city,
      p_region: geo.region,
      p_country: geo.country,
    });
    if (error) console.warn("visit log failed", error);
  }

  function wireConsent(sb) {
    const current = getConsent();
    if (!current) {
      els.consent.hidden = false;
    }
    els.consentAccept?.addEventListener("click", async () => {
      setConsent("accepted");
      els.consent.hidden = true;
      await logVisit(sb);
    });
    els.consentRefuse?.addEventListener("click", () => {
      setConsent("refused");
      els.consent.hidden = true;
    });
  }

  function wireAmountPills() {
    document.querySelectorAll(".pill[data-amount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pill[data-amount]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        els.amount.value = btn.dataset.amount;
        setFieldError(els.errAmount, "");
      });
    });

    els.amount?.addEventListener("input", () => {
      const v = String(Number(els.amount.value));
      document.querySelectorAll(".pill[data-amount]").forEach((b) => {
        b.classList.toggle("active", b.dataset.amount === v);
      });
      setFieldError(els.errAmount, "");
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFieldError(els.errAmount, "");
    setFieldError(els.errName, "");
    setBanner("");

    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Donations are unavailable — Supabase is not configured.", "err");
      return;
    }

    const amount = Number(els.amount.value);
    const donor = String(els.name.value || "").trim();
    let bad = false;
    if (!Number.isFinite(amount) || amount <= 0) {
      setFieldError(els.errAmount, "Enter an amount greater than 0.");
      bad = true;
    }
    if (donor.length > 80) {
      setFieldError(els.errName, "Keep your name under 80 characters.");
      bad = true;
    }
    if (bad) return;

    els.submit.disabled = true;
    setBanner("Recording donation…");

    const { error } = await sb.rpc("record_donation", {
      p_amount: amount,
      p_referral_code: state.code || null,
      p_employee_id: state.employee?.id || null,
      p_donor_label: donor || null,
    });
    els.submit.disabled = false;

    if (error) {
      setBanner(error.message || "Could not record donation.", "err");
      return;
    }

    setBanner("", null);
    els.formWrap.hidden = true;
    els.success.hidden = false;
    const via = state.employee ? ` via ${state.employee.first_name}'s link` : "";
    els.successMsg.textContent = `Your ${money(amount)} gift${via} helps dogs get food, water, and shelter.`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wireAmountPills();
    els.form?.addEventListener("submit", onSubmit);
    els.again?.addEventListener("click", () => {
      els.success.hidden = true;
      els.formWrap.hidden = false;
      els.form.reset();
      els.amount.value = "10";
      document.querySelectorAll(".pill[data-amount]").forEach((b) => {
        b.classList.toggle("active", b.dataset.amount === "10");
      });
    });

    const params = new URLSearchParams(window.location.search);
    state.code = String(params.get("code") || "").trim();

    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Add Supabase credentials in js/config.js to enable donations.", "err");
      return;
    }

    wireConsent(sb);

    try {
      if (state.code) {
        state.employee = await resolveEmployee(sb, state.code);
        if (state.employee) {
          els.lead.textContent = `You're supporting through ${state.employee.first_name} ${state.employee.last_name}'s link. Every dollar helps dogs in need.`;
        } else {
          els.lead.textContent =
            "We couldn't match that QR code, but you can still donate. Every dollar helps.";
        }
      }
      if (getConsent() === "accepted") await logVisit(sb);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not load donation page.", "err");
    }
  });
})();
