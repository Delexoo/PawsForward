(function () {
  const video = document.getElementById("home-hero-video");
  const contact = document.getElementById("home-contact");
  const email = String(window.SITE_CONFIG?.contactEmail || "hello@pawsforward.org").trim();

  if (contact && email) {
    contact.href = `mailto:${email}`;
    contact.textContent = email;
  }

  if (!video) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    video.removeAttribute("autoplay");
    video.pause();
    video.removeAttribute("src");
    video.load();
    document.body.classList.add("pf-home-reduced-motion");
    return;
  }

  const tryPlay = () => {
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  video.addEventListener("error", () => {
    document.body.classList.add("pf-home-video-failed");
  });

  if (video.readyState >= 2) tryPlay();
  else video.addEventListener("loadeddata", tryPlay, { once: true });
})();
