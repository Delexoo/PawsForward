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
  const ANIM_MS = 900;
  const EXIT_MS = 1300;
  let videoReady = false;
  let dismissed = false;
  let lastPainted = -1;

  if (ring) {
    ring.style.strokeDasharray = String(CIRC);
    ring.style.strokeDashoffset = String(CIRC);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function paintProgress(pct) {
    const value = Math.round(pct);
    if (value !== lastPainted) {
      lastPainted = value;
      if (pctEl) pctEl.textContent = value + "%";
    }
    if (ring) {
      ring.style.strokeDashoffset = String(CIRC * (1 - pct / 100));
    }
  }

  function finish() {
    if (dismissed) return;
    dismissed = true;
    paintProgress(100);
    if (loader) {
      // Force layout so the exit transition always runs
      void loader.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          loader.classList.add("is-done");
          loader.setAttribute("aria-busy", "false");
          loader.setAttribute("aria-label", "Loaded");
        });
      });
      window.setTimeout(() => {
        loader.hidden = true;
      }, EXIT_MS + 60);
    }
    document.body.classList.remove("pf-home-loading");
    document.body.classList.add("pf-home-ready");
  }

  function tryPlay() {
    if (!video) return;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }

  function markVideoReady() {
    if (videoReady) return;
    videoReady = true;
    tryPlay();
  }

  function runSmoothLoad() {
    const start = performance.now();
    paintProgress(0);

    function frame(now) {
      const t = Math.min(1, (now - start) / ANIM_MS);
      const pct = easeInOutCubic(t) * 100;
      paintProgress(pct);

      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }

      paintProgress(100);
      const after = () => finish();
      if (videoReady || !video) {
        window.setTimeout(after, 80);
      } else {
        const waitStart = performance.now();
        const poll = () => {
          if (videoReady || performance.now() - waitStart > 2500) {
            after();
            return;
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }
    }

    requestAnimationFrame(frame);
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
    paintProgress(100);
    finish();
    return;
  }

  if (video) {
    video.addEventListener("loadeddata", () => {
      markVideoReady();
      tryPlay();
    });
    video.addEventListener("canplay", markVideoReady);
    video.addEventListener("canplaythrough", markVideoReady);
    video.addEventListener("playing", markVideoReady);
    video.addEventListener("error", () => {
      document.body.classList.add("pf-home-video-failed");
      markVideoReady();
    });
    window.setTimeout(markVideoReady, 10000);
    if (video.readyState >= 2) {
      markVideoReady();
      tryPlay();
    }
  } else {
    markVideoReady();
  }

  runSmoothLoad();
})();

/* Site menu */
(function () {
  const menu = document.getElementById("site-menu");
  const btn = document.getElementById("site-menu-btn");
  const closeBtn = document.getElementById("site-menu-close");
  const backdrop = document.getElementById("site-menu-backdrop");
  if (!menu || !btn) return;

  function openMenu() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Close menu");
    document.body.classList.add("pf-site-menu-open");
    closeBtn?.focus();
  }

  function closeMenu() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("pf-site-menu-open");
    btn.focus();
  }

  function toggle() {
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  btn.addEventListener("click", toggle);
  closeBtn?.addEventListener("click", closeMenu);
  backdrop?.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) closeMenu();
  });

  const hero = document.querySelector(".pf-home-hero");
  function syncBarTone() {
    if (!hero) return;
    const past = window.scrollY > hero.offsetHeight * 0.72;
    document.body.classList.toggle("pf-site-bar-solid", past);
  }
  window.addEventListener("scroll", syncBarTone, { passive: true });
  syncBarTone();
})();

/* Animated FAQ accordion */
(function () {
  const items = Array.from(document.querySelectorAll(".pf-home-faq .pf-faq-item"));
  if (!items.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setOpen(item, open) {
    const summary = item.querySelector("summary");
    const panel = item.querySelector(".pf-faq-panel");
    item.classList.toggle("is-open", open);
    if (summary) summary.setAttribute("aria-expanded", open ? "true" : "false");
    if (panel) panel.style.gridTemplateRows = open ? "1fr" : "0fr";
  }

  items.forEach((item) => {
    const summary = item.querySelector("summary");
    const panel = item.querySelector(".pf-faq-panel");
    if (!summary || !panel) return;

    item.classList.add("pf-faq-item--js");
    item.open = true; // keep answer in DOM for height animation
    setOpen(item, false);

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const opening = !item.classList.contains("is-open");

      items.forEach((other) => {
        if (other === item) setOpen(other, opening);
        else if (other.classList.contains("is-open")) setOpen(other, false);
      });

      if (reduceMotion) return;
    });
  });
})();
