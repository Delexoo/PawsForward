(function () {
  const els = {
    banner: document.getElementById("status-banner"),
    lead: document.getElementById("donate-lead"),
    formWrap: document.getElementById("donate-form-wrap"),
    form: document.getElementById("donate-form"),
    amount: document.getElementById("donate-amount"),
    name: document.getElementById("donate-name"),
    submit: document.getElementById("donate-submit"),
    success: document.getElementById("donate-success"),
    successMsg: document.getElementById("donate-success-msg"),
    again: document.getElementById("donate-again"),
  };

  const state = {
    code: "",
    employee: null,
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

  function money(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  }

  async function resolveEmployee(sb, code) {
    if (!code) return null;
    const { data, error } = await sb
      .from("employees")
      .select("id,first_name,last_name,referral_code")
      .eq("referral_code", code)
      .maybeSingle();
    if (error) throw error;
    return data;
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
    const geo = await fetchGeo();
    const row = {
      employee_id: state.employee?.id || null,
      referral_code: state.code || null,
      path: window.location.pathname + window.location.search,
      city: geo.city,
      region: geo.region,
      country: geo.country,
    };
    const { error } = await sb.from("visits").insert(row);
    if (error) console.warn("visit log failed", error);
  }

  function wireAmountPills() {
    document.querySelectorAll(".pill[data-amount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".pill[data-amount]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        els.amount.value = btn.dataset.amount;
      });
    });

    els.amount?.addEventListener("input", () => {
      const v = String(Number(els.amount.value));
      document.querySelectorAll(".pill[data-amount]").forEach((b) => {
        b.classList.toggle("active", b.dataset.amount === v);
      });
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Donations are unavailable — Supabase is not configured.", "err");
      return;
    }

    const amount = Number(els.amount.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBanner("Enter a valid donation amount.", "err");
      return;
    }

    els.submit.disabled = true;
    setBanner("Recording donation…");

    const payload = {
      employee_id: state.employee?.id || null,
      referral_code: state.code || null,
      amount,
      donor_label: String(els.name.value || "").trim() || null,
    };

    const { error } = await sb.from("donations").insert(payload);
    els.submit.disabled = false;

    if (error) {
      setBanner(error.message || "Could not record donation.", "err");
      return;
    }

    setBanner("", null);
    els.formWrap.hidden = true;
    els.success.hidden = false;
    const via = state.employee
      ? ` via ${state.employee.first_name}'s link`
      : "";
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
      await logVisit(sb);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not load donation page.", "err");
    }
  });
})();
