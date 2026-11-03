(function () {
  const els = {
    lead: document.getElementById("donate-lead"),
    attr: document.getElementById("donate-attr"),
    banner: document.getElementById("status-banner"),
    formPanel: document.getElementById("donate-form-panel"),
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
    retry: document.getElementById("donate-retry"),
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

  function anonKey() {
    return String(window.SITE_CONFIG?.supabaseAnonKey || "");
  }

  async function resolveEmployee() {
    if (!referralCode) {
      if (els.lead) els.lead.textContent = "This link is missing an employee code.";
      setBanner("Open a valid employee QR to donate.", "err");
      return false;
    }
    const sb = window.SiteSupabase?.getClient?.();
    if (!sb) {
      setBanner("Donation system is not configured.", "err");
      return false;
    }
    const { data, error } = await sb.rpc("resolve_employee_by_code", { p_code: referralCode });
    if (error) {
      console.error(error);
      setBanner(error.message || "Could not verify this QR.", "err");
      return false;
    }
    employee = Array.isArray(data) ? data[0] : data;
    if (!employee?.id) {
      setBanner("This QR is not linked to an active employee.", "err");
      return false;
    }
    const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
    if (els.attr) {
      els.attr.hidden = false;
      els.attr.textContent = `Attributed to ${name}`;
    }
    return true;
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
    if (els.formPanel) els.formPanel.hidden = true;
    setBanner("Confirming your donation…");
    try {
      const res = await fetch(`${base}/confirm-donation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not confirm donation.");
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
      setBanner(err.message || "Payment may have succeeded — thank you.", "err");
      if (els.success) els.success.hidden = false;
    }
  }

  async function startCheckout() {
    if (!referralCode) {
      setBanner("Missing employee referral code.", "err");
      return;
    }
    const base = functionsBase();
    if (!base) {
      setBanner("Checkout is not configured.", "err");
      return;
    }
    if (els.retry) els.retry.hidden = true;
    if (els.lead) els.lead.textContent = "Taking you to Stripe Checkout…";
    setBanner("Opening secure Stripe checkout…");
    try {
      const res = await fetch(`${base}/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
          Authorization: "Bearer " + anonKey(),
        },
        body: JSON.stringify({
          custom_amount: true,
          referral_code: referralCode,
          site_origin: siteOrigin(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || "Could not start checkout.");
      location.replace(body.url);
    } catch (err) {
      console.error(err);
      if (els.lead) els.lead.textContent = "Could not open Stripe right now.";
      setBanner(err.message || "Could not start Stripe checkout.", "err");
      if (els.retry) els.retry.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    els.retry?.addEventListener("click", () => startCheckout());

    if (params.get("success") === "1" && params.get("session_id")) {
      if (els.formPanel) els.formPanel.hidden = true;
      await resolveEmployee();
      await confirmCheckout(params.get("session_id"));
      return;
    }

    if (params.get("cancelled") === "1") {
      if (els.lead) els.lead.textContent = "Checkout cancelled.";
      setBanner("You can try again whenever you’re ready.", "err");
      if (els.retry) els.retry.hidden = false;
      await resolveEmployee();
      return;
    }

    const ok = await resolveEmployee();
    if (!ok) {
      if (els.retry) els.retry.hidden = false;
      return;
    }
    await recordScan();
    await startCheckout();
  });
})();
