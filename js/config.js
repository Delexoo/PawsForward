window.SITE_CONFIG = {
  supabaseUrl: "https://fnkccwjoyfnackmdycti.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZua2Njd2pveWZuYWNrbWR5Y3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2ODAzMjcsImV4cCI6MjEwOTI1NjMyN30.jrBk2da06ubL_vzdN80m10ObubHDlsvX1lK_qJL_lx4",
  commissionRate: 0.5,
  appName: "PawsForward",
  /** Bump when shipping UI so browsers skip stale JS/CSS. */
  assetVersion: "20261109n",
  contactEmail: "joinpawsforward@outlook.com",
  privacyEmail: "joinpawsforward@outlook.com",
  siteOrigin: "https://joinpawsforward.com",
  vapidPublicKey: "BC44d9O-FcxjkVEOZGvwpSAvmY5YwO03tMJPxx78djzLoBgIHnPd74_5mlOj0mwRo678Tojax67JszXuWHpc6Qs",
};

/** Stripe Checkout URL — donors go here directly (no donate interstitial). */
window.SITE_CONFIG.checkoutUrl = function (ref) {
  const base = String(window.SITE_CONFIG.supabaseUrl || "").replace(/\/$/, "");
  const origin = String(window.SITE_CONFIG.siteOrigin || "").replace(/\/$/, "");
  const u = new URL(`${base}/functions/v1/create-checkout`);
  if (origin) u.searchParams.set("site_origin", origin);
  const code = String(ref || "").trim();
  if (code) u.searchParams.set("ref", code);
  return u.href;
};
