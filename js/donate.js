/**
 * Donate thank-you after Stripe return. Checkout itself is a head redirect in donate.html
 * (or a direct Edge link from home) — no interstitial UI.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const els = {
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
  };

  function functionsBase() {
    const url = String(window.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function anonKey() {
    return String(window.SITE_CONFIG?.supabaseAnonKey || "");
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
      if (els.success) els.success.hidden = false;
      await confirmCheckout(params.get("session_id"));
    }
  });
})();
