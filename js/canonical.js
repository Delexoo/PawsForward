/**
 * Keep absolute canonical URLs aligned with SITE_CONFIG.siteOrigin.
 * Strips query/hash so dashboard deep-links don't pollute the canonical.
 */
(function () {
  const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  if (!origin) return;

  const file = location.pathname.split("/").pop() || "index.html";
  const map = {
    "index.html": `${origin}/`,
    "": `${origin}/`,
    "admin.html": `${origin}/admin.html`,
    "donate.html": `${origin}/donate.html`,
    "join.html": `${origin}/join.html`,
    "login.html": `${origin}/login.html`,
    "404.html": `${origin}/404.html`,
  };
  const href = map[file] || `${origin}/${file}`;

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;

  // Keep Open Graph URL in sync when present (dashboard SEO tooling).
  let og = document.querySelector('meta[property="og:url"]');
  if (!og) {
    og = document.createElement("meta");
    og.setAttribute("property", "og:url");
    document.head.appendChild(og);
  }
  og.setAttribute("content", href);
})();
