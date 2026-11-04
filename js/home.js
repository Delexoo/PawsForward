(function () {
  const video = document.getElementById("home-hero-video");
  const loader = document.getElementById("home-loader");
  const pctEl = document.getElementById("home-loader-pct");
  const ring = document.getElementById("home-loader-progress");
  const contact = document.getElementById("home-contact");
  const email = String(window.SITE_CONFIG?.contactEmail || "hello@pawsforward.org").trim();

  if (contact && email) {
    contact.href = `mailto:${email}`;
    contact.textContent = email;
  }

  const CIRC = 2 * Math.PI * 40;
  let shown = 0;
  let target = 0;
  let ready = false;
  let dismissed = false;
  let raf = 0;

  if (ring) {
    ring.style.strokeDasharray = String(CIRC);
    ring.style.strokeDashoffset = String(CIRC);
  }

  function setProgress(n) {
    target = Math.max(target, Math.min(100, Math.round(n)));
  }

  function paint() {
    shown += (target - shown) * 0.18;
    if (target >= 100 && shown > 99.4) shown = 100;
    const value = Math.round(shown);
    if (pctEl) pctEl.textContent = value + "%";
    if (ring) {
      ring.style.strokeDashoffset = String(CIRC * (1 - shown / 100));
    }
    if (shown < 100) {
      raf = requestAnimationFrame(paint);
      return;
    }
    raf = 0;
    finish();
  }

  function bump() {
    if (!raf) raf = requestAnimationFrame(paint);
  }

  function finish() {
    if (dismissed) return;
    dismissed = true;
    if (loader) {
      loader.classList.add("is-done");
      loader.setAttribute("aria-busy", "false");
      loader.setAttribute("aria-label", "Loaded");
      window.setTimeout(() => {
        loader.hidden = true;
      }, 600);
    }
    document.body.classList.remove("pf-home-loading");
    document.body.classList.add("pf-home-ready");
  }

  function tryPlay() {
    if (!video) return;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function bufferedPct() {
    if (!video || !video.duration || !Number.isFinite(video.duration)) return 0;
    try {
      if (!video.buffered.length) return 0;
      const end = video.buffered.end(video.buffered.length - 1);
      return Math.min(100, (end / video.duration) * 100);
    } catch {
      return 0;
    }
  }

  function markReady() {
    if (ready) return;
    ready = true;
    setProgress(100);
    bump();
    tryPlay();
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    document.body.classList.add("pf-home-reduced-motion");
    if (video) {
      video.removeAttribute("autoplay");
      video.pause();
      video.removeAttribute("src");
      while (video.firstChild) video.removeChild(video.firstChild);
      video.load();
    }
    setProgress(100);
    bump();
    return;
  }

  if (!video) {
    setProgress(100);
    bump();
    return;
  }

  setProgress(8);
  bump();

  video.addEventListener("loadstart", () => {
    setProgress(12);
    bump();
  });
  video.addEventListener("loadedmetadata", () => {
    setProgress(28);
    bump();
  });
  video.addEventListener("loadeddata", () => {
    setProgress(55);
    bump();
    tryPlay();
  });
  video.addEventListener("canplay", () => {
    setProgress(Math.max(78, bufferedPct()));
    bump();
    tryPlay();
  });
  video.addEventListener("canplaythrough", markReady);
  video.addEventListener("playing", () => {
    setProgress(Math.max(88, bufferedPct()));
    bump();
    // Enough to show — don't wait for full file
    window.setTimeout(markReady, 180);
  });
  video.addEventListener("progress", () => {
    if (ready) return;
    const b = bufferedPct();
    if (b > 0) {
      setProgress(Math.min(92, 30 + b * 0.62));
      bump();
    }
  });
  video.addEventListener("error", () => {
    document.body.classList.add("pf-home-video-failed");
    markReady();
  });

  // Safety: never leave users stuck on the loader
  window.setTimeout(markReady, 8000);

  if (video.readyState >= 3) {
    markReady();
  } else if (video.readyState >= 2) {
    setProgress(70);
    bump();
    tryPlay();
  }
})();
