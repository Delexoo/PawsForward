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
  const MIN_MS = 2200;
  const EXIT_MS = 1100;
  const startedAt = performance.now();
  let shown = 0;
  let target = 0;
  let ready = false;
  let dismissed = false;
  let raf = 0;
  let lastTs = 0;

  if (ring) {
    ring.style.strokeDasharray = String(CIRC);
    ring.style.strokeDashoffset = String(CIRC);
  }

  function setProgress(n) {
    target = Math.max(target, Math.min(100, n));
  }

  function paint(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;

    // Frame-rate independent ease — slower chase toward target
    const ease = 1 - Math.pow(0.965, dt);
    shown += (target - shown) * ease;

    // Soft ceiling until truly ready so % never snaps
    if (!ready && shown > 90) {
      shown = 90 + (shown - 90) * 0.35;
      if (target > 92) target = 92;
    }

    if (ready && target >= 100 && shown > 99.2) shown = 100;

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
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(paint);
    }
  }

  function finish() {
    if (dismissed) return;
    dismissed = true;
    if (loader) {
      // One frame so the 100% paint settles, then ease the sheet up
      requestAnimationFrame(() => {
        loader.classList.add("is-done");
        loader.setAttribute("aria-busy", "false");
        loader.setAttribute("aria-label", "Loaded");
      });
      window.setTimeout(() => {
        loader.hidden = true;
      }, EXIT_MS + 80);
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
    tryPlay();
    const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    window.setTimeout(() => {
      setProgress(100);
      bump();
    }, wait);
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

  setProgress(6);
  bump();

  video.addEventListener("loadstart", () => {
    setProgress(14);
    bump();
  });
  video.addEventListener("loadedmetadata", () => {
    setProgress(26);
    bump();
  });
  video.addEventListener("loadeddata", () => {
    setProgress(48);
    bump();
    tryPlay();
  });
  video.addEventListener("canplay", () => {
    setProgress(Math.max(64, Math.min(82, 40 + bufferedPct() * 0.4)));
    bump();
    tryPlay();
  });
  video.addEventListener("canplaythrough", markReady);
  video.addEventListener("playing", () => {
    setProgress(Math.max(78, Math.min(88, 50 + bufferedPct() * 0.35)));
    bump();
    window.setTimeout(markReady, 420);
  });
  video.addEventListener("progress", () => {
    if (ready) return;
    const b = bufferedPct();
    if (b > 0) {
      setProgress(Math.min(86, 24 + b * 0.55));
      bump();
    }
  });
  video.addEventListener("error", () => {
    document.body.classList.add("pf-home-video-failed");
    markReady();
  });

  window.setTimeout(markReady, 10000);

  if (video.readyState >= 3) {
    setProgress(72);
    bump();
    tryPlay();
    window.setTimeout(markReady, 500);
  } else if (video.readyState >= 2) {
    setProgress(58);
    bump();
    tryPlay();
  }
})();
