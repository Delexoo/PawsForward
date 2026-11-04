/**
 * Thank-you / cancel after Stripe. Checkout itself is a head redirect (or direct Edge link).
 */
(function () {
  const params = new URLSearchParams(location.search);
  const els = {
    success: document.getElementById("donate-success"),
    successText: document.getElementById("donate-success-text"),
    cancelled: document.getElementById("donate-cancelled"),
    retry: document.getElementById("donate-retry"),
  };

  function functionsBase() {
    const url = String(window.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : "";
  }

  function anonKey() {
    return String(window.SITE_CONFIG?.supabaseAnonKey || "");
  }

  function checkoutHref(ref) {
    if (typeof window.SITE_CONFIG?.checkoutUrl === "function") {
      return window.SITE_CONFIG.checkoutUrl(ref);
    }
    const base = functionsBase();
    const origin = String(window.SITE_CONFIG?.siteOrigin || "https://joinpawsforward.com").replace(/\/$/, "");
    const u = new URL(`${base}/create-checkout`);
    u.searchParams.set("site_origin", origin);
    if (ref) u.searchParams.set("ref", ref);
    return u.href;
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
    const ref = String(params.get("ref") || "").trim();
    if (els.retry) els.retry.href = checkoutHref(ref);

    if (params.get("success") === "1" && params.get("session_id")) {
      if (els.success) els.success.hidden = false;
      await confirmCheckout(params.get("session_id"));
      return;
    }

    if (params.get("cancelled") === "1") {
      if (els.cancelled) els.cancelled.hidden = false;
      return;
    }

    // Fallback if head redirect did not run (stale cache / blocked script).
    location.replace(checkoutHref(ref));
  });
})();
