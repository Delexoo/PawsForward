(function () {
  const els = {
    lead: document.getElementById("donate-lead"),
    attr: document.getElementById("donate-attr"),
    banner: document.getElementById("status-banner"),
    formPanel: document.getElementById("donate-form-panel"),
    amount: document.getElementById("donate-amount"),
    name: document.getElementById("donate-name"),
    submit: document.getElementById("donate-submit"),
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
  };

  const params = new URLSearchParams(location.search);
  const referralCode = String(params.get("ref") || "").trim();
  let employee = null;

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

  function functionsBase() {
    const url = String(window.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function siteOrigin() {
    return String(window.SITE_CONFIG?.siteOrigin || location.origin).replace(/\/$/, "");
  }

  async function resolveEmployee() {
    if (!referralCode) {
      if (els.lead) els.lead.textContent = "This link is missing an employee code.";
      setBanner("Open a valid employee QR to donate.", "err");
      if (els.submit) els.submit.disabled = true;
      return;
    }
    const sb = window.SiteSupabase?.getClient?.();
    if (!sb) {
      setBanner("Donation system is not configured.", "err");
      return;
    }
    const { data, error } = await sb.rpc("resolve_employee_by_code", { p_code: referralCode });
    if (error) {
      console.error(error);
      setBanner(error.message || "Could not verify this QR.", "err");
      return;
    }
    employee = Array.isArray(data) ? data[0] : data;
    if (!employee?.id) {
      setBanner("This QR is not linked to an active employee.", "err");
      if (els.submit) els.submit.disabled = true;
      return;
    }
    const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
    if (els.lead) els.lead.textContent = "Choose any amount. Checkout is powered by Stripe.";
    if (els.attr) {
      els.attr.hidden = false;
      els.attr.textContent = `Attributed to ${name}`;
    }
  }

  async function recordScan() {
    if (!referralCode) return;
    const sb = window.SiteSupabase?.getClient?.();
    if (!sb) return;
    try {
      await sb.rpc("record_visit", {
        p_referral_code: referralCode,
        p_employee_id: employee?.id || null,
        p_path: location.pathname + location.search,
        p_city: null,
        p_region: null,
        p_country: null,
      });
    } catch (err) {
      console.warn(err);
    }
  }

  async function confirmCheckout(sessionId) {
    const base = functionsBase();
    if (!base || !sessionId) return;
    setBanner("Confirming your donation…");
    try {
      const res = await fetch(`${base}/confirm-donation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: String(window.SITE_CONFIG?.supabaseAnonKey || ""),
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not confirm donation.");
      if (els.formPanel) els.formPanel.hidden = true;
      if (els.success) els.success.hidden = false;
      const amount = body?.donation?.amount;
      if (els.successText) {
        els.successText.textContent = amount
          ? `We received ${Number(amount).toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}. Thank you for supporting the rescue.`
          : "Your donation went through. Thank you for supporting the rescue.";
      }
      setBanner("Donation recorded.", "ok");
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Payment may have succeeded — refresh the admin Donations page.", "err");
      if (els.formPanel) els.formPanel.hidden = true;
      if (els.success) els.success.hidden = false;
    }
  }

  async function startCheckout() {
    const amount = Number(els.amount?.value);
    if (!Number.isFinite(amount) || amount < 1) {
      setBanner("Enter at least $1.", "err");
      return;
    }
    if (!referralCode) {
      setBanner("Missing employee referral code.", "err");
      return;
    }
    const base = functionsBase();
    if (!base) {
      setBanner("Checkout is not configured.", "err");
      return;
    }
    els.submit.disabled = true;
    setBanner("Opening Stripe Checkout…");
    try {
      const res = await fetch(`${base}/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: String(window.SITE_CONFIG?.supabaseAnonKey || ""),
        },
        body: JSON.stringify({
          amount,
          referral_code: referralCode,
          donor_label: String(els.name?.value || "").trim(),
          site_origin: siteOrigin(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start checkout.");
      location.assign(body.url);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not start Stripe checkout.", "err");
      els.submit.disabled = false;
    }
  }

  function wireAmounts() {
    document.querySelectorAll("[data-amount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-amount]").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        if (els.amount) els.amount.value = btn.getAttribute("data-amount") || "50";
      });
    });
    els.amount?.addEventListener("input", () => {
      document.querySelectorAll("[data-amount]").forEach((b) => b.classList.remove("is-active"));
    });
    els.submit?.addEventListener("click", startCheckout);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wireAmounts();
    if (params.get("cancelled") === "1") {
      setBanner("Checkout cancelled. You can try again anytime.", "err");
    }
    await resolveEmployee();
    if (params.get("success") === "1" && params.get("session_id")) {
      await confirmCheckout(params.get("session_id"));
      return;
    }
    await recordScan();
  });
})();
