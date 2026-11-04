window.SITE_CONFIG = {
  supabaseUrl: "https://tauiyhyjujddsgvlihef.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdWl5aHlqdWpkZHNndmxpaGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NzAwMzUsImV4cCI6MjEwOTE0NjAzNX0.PUO-GkCX1BkER3wGe7HvwAWyBR5N3T_eS6Xu5sOtPAM",
  commissionRate: 0.5,
  appName: "PawsForward",
  /** Bump when shipping UI so browsers skip stale JS/CSS. */
  assetVersion: "20261107h",
  contactEmail: "hello@pawsforward.org",
  privacyEmail: "privacy@pawsforward.org",
  siteOrigin: "https://joinpawsforward.com",
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
