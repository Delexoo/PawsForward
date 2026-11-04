/**
 * Donate = redirect straight to Stripe via create-checkout GET (no interstitial card).
 * Success return (?success=1&session_id=) shows a short thank-you only.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const referralCode = String(params.get("ref") || "").trim();
  const els = {
    redirect: document.getElementById("donate-redirect"),
    lead: document.getElementById("donate-lead"),
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
  };

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

  function checkoutUrl() {
    const base = functionsBase();
    if (!base) return "";
    const u = new URL(`${base}/create-checkout`);
    if (referralCode) u.searchParams.set("ref", referralCode);
    u.searchParams.set("site_origin", siteOrigin());
    return u.href;
  }

  function goToStripe() {
    const url = checkoutUrl();
    if (!url) {
      if (els.lead) {
        els.lead.textContent = "Checkout is not configured.";
      }
      return;
    }
    if (els.lead) els.lead.textContent = "Opening Stripe Checkout…";
    // Full navigation — Edge responds with 303 to Stripe (no CORS).
    location.replace(url);
  }

  async function confirmCheckout(sessionId) {
    const base = functionsBase();
    if (!base || !sessionId) return;
    try {
      const res = await fetch(`${base}/confirm-donation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey(),
          Authorization: "Bearer " + anonKey(),
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not confirm donation.");
      const amount = body?.donation?.amount;
      if (els.successText) {
        els.successText.textContent = amount
          ? `We received ${Number(amount).toLocaleString(undefined, {
              style: "currency",
              currency: "USD",
            })}. Thank you for supporting the rescue.`
          : "Your donation went through. Thank you for supporting the rescue.";
      }
    } catch (err) {
      console.error(err);
      if (els.successText) {
        els.successText.textContent =
          "Payment may have succeeded — thank you for supporting the rescue.";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (params.get("success") === "1" && params.get("session_id")) {
      if (els.redirect) els.redirect.hidden = true;
      if (els.success) els.success.hidden = false;
      await confirmCheckout(params.get("session_id"));
      return;
    }

    // Cancelled checkout → send them to Stripe again (no middle page).
    if (params.get("cancelled") === "1") {
      goToStripe();
      return;
    }

    goToStripe();
  });
})();
