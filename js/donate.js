(function () {
  const els = {
    lead: document.getElementById("donate-lead"),
    attr: document.getElementById("donate-attr"),
    banner: document.getElementById("status-banner"),
    formPanel: document.getElementById("donate-form-panel"),
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
    retry: document.getElementById("donate-retry"),
    note: document.getElementById("donate-note"),
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
      if (els.lead) els.lead.textContent = "Taking you to Stripe Checkout…";
      if (els.note) {
        els.note.textContent =
          "Choose any amount on the secure Stripe page. Your gift goes directly to PawsForward.";
      }
      if (els.attr) {
        els.attr.hidden = false;
        els.attr.textContent = "Direct donation · not attributed to a QR";
      }
      return true;
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
    const base = functionsBase();
    const key = anonKey();
    if (!base || !key) return;
    try {
      const res = await fetch(`${base}/record-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({
          referral_code: referralCode,
          employee_id: employee?.id || null,
          path: location.pathname + location.search,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `record-visit ${res.status}`);
      }
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
    const base = functionsBase();
    if (!base) {
      setBanner("Checkout is not configured.", "err");
      return;
    }
    if (els.retry) els.retry.hidden = true;
    if (els.lead) els.lead.textContent = "Taking you to Stripe Checkout…";
    setBanner("Opening secure Stripe checkout…");
    try {
      const payload = {
        custom_amount: true,
        site_origin: siteOrigin(),
      };
      if (referralCode) payload.referral_code = referralCode;

      const res = await fetch(`${base}/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
          Authorization: "Bearer " + anonKey(),
        },
        body: JSON.stringify(payload),
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
