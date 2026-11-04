/**
 * Keep absolute canonical URLs aligned with SITE_CONFIG.siteOrigin.
 * Strips query/hash so dashboard deep-links don't pollute the canonical.
 */
(function () {
  const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  if (!origin) return;

  let path = String(location.pathname || "/").replace(/\/+$/, "") || "/";
  path = path.replace(/\.html$/i, "");
  if (path === "/index") path = "/";

  const map = {
    "/": `${origin}/`,
    "/admin": `${origin}/admin`,
    "/donate": `${origin}/donate`,
    "/join": `${origin}/join`,
    "/privacy": `${origin}/privacy`,
    "/terms": `${origin}/terms`,
    "/login": `${origin}/login`,
    "/404": `${origin}/404`,
    "/qr": `${origin}/qr`,
  };
  const href = map[path] || `${origin}${path}`;

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;

  let og = document.querySelector('meta[property="og:url"]');
  if (!og) {
    og = document.createElement("meta");
    og.setAttribute("property", "og:url");
    document.head.appendChild(og);
  }
  og.setAttribute("content", href);
})();
