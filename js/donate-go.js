/**
 * Instant Stripe handoff — must be an external file (CSP blocks inline scripts).
 * Skips redirect on success/cancel return from Checkout.
 */
(function () {
  var params = new URLSearchParams(location.search);
  if (params.get("success") === "1" && params.get("session_id")) return;
  if (params.get("cancelled") === "1") return;

  var base =
    (window.SITE_CONFIG && window.SITE_CONFIG.supabaseUrl) ||
    "https://fnkccwjoyfnackmdycti.supabase.co";
  var origin =
    (window.SITE_CONFIG && window.SITE_CONFIG.siteOrigin) ||
    "https://joinpawsforward.com";
  var u = new URL(String(base).replace(/\/$/, "") + "/functions/v1/create-checkout");
  var ref = String(params.get("ref") || "").trim();
  if (ref) u.searchParams.set("ref", ref);
  u.searchParams.set("site_origin", String(origin).replace(/\/$/, ""));
  location.replace(u.href);
})();
