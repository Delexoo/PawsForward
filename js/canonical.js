/**
 * Keep absolute canonical URLs aligned with SITE_CONFIG.siteOrigin.
 */
(function () {
  const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  if (!origin) return;

  const path = location.pathname.split("/").pop() || "index.html";
  const map = {
    "index.html": `${origin}/`,
    "": `${origin}/`,
    "admin.html": `${origin}/admin.html`,
    "donate.html": `${origin}/donate.html`,
    "login.html": `${origin}/login.html`,
    "404.html": `${origin}/404.html`,
  };
  const href = map[path] || `${origin}/${path}`;

  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
})();
