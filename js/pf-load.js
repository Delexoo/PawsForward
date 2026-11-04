(function () {
  const loader = document.querySelector("#loader");
  const count = loader?.querySelector(".loader-count");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const navKey = "pf-nav";

  function mountRing() {
    const svg = loader?.querySelector(".loader-ring");
    if (!svg || svg.tagName.toLowerCase() === "canvas") return () => {};
    const canvas = document.createElement("canvas");
    canvas.className = "loader-ring";
    canvas.setAttribute("aria-hidden", "true");
    svg.replaceWith(canvas);
    const ctx = canvas.getContext("2d");
    let drawnWidth = 0;
    let drawnRatio = 0;

    return function draw(progress) {
      const css = canvas.clientWidth || 108;
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      if (css !== drawnWidth || ratio !== drawnRatio) {
        drawnWidth = css;
        drawnRatio = ratio;
        canvas.width = Math.round(css * ratio);
        canvas.height = Math.round(css * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, css, css);
      const line = 3.5;
      const radius = (css - line) / 2;
      const center = css / 2;
      ctx.lineWidth = line;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#e6e6ea";
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.stroke();
      const amount = Math.max(0, Math.min(1, progress / 100));
      if (amount <= 0) return;
      ctx.strokeStyle = "#1d1d1f";
      ctx.beginPath();
      const start = -Math.PI / 2;
      ctx.arc(center, center, radius, start, start + Math.PI * 2 * amount);
      ctx.stroke();
    };
  }

  function readNav() {
    try {
      return sessionStorage.getItem(navKey) === "1";
    } catch {
      return false;
    }
  }

  function markNav() {
    try {
      sessionStorage.setItem(navKey, "1");
    } catch {
      /* ignore */
    }
  }

  function clearNav() {
    try {
      sessionStorage.removeItem(navKey);
    } catch {
      /* ignore */
    }
  }

  function navType() {
    try {
      const entry = performance.getEntriesByType?.("navigation")?.[0];
      return entry?.type || "";
    } catch {
      return "";
    }
  }

  // Internal in-site clicks set pf-nav / pf-nav-skip. Loader only for visit + refresh.
  const arriving =
    readNav() || document.documentElement.classList.contains("pf-nav-skip");
  clearNav();

  function hideLoader() {
    if (!loader) return;
    loader.classList.add("is-done");
    loader.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    document.documentElement.classList.remove("pf-nav-skip", "pf-nav-in");
  }

  function showLoader() {
    if (!loader) return;
    loader.classList.remove("is-done", "is-leave");
    loader.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  function setProgress(value) {
    const next = Math.max(0, Math.min(100, value));
    if (count) count.textContent = `${Math.round(next)}%`;
    drawRing(next);
  }

  let drawRing = () => {};
  let countRun = 0;
  let busy = false;

  function animateCount(ms, from = 0, to = 100) {
    const run = ++countRun;
    setProgress(from);
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        if (run !== countRun) return;
        const t = Math.min(1, (now - start) / ms);
        setProgress(from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function slideAway() {
    return new Promise((resolve) => {
      if (!loader) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      loader.addEventListener(
        "transitionend",
        (event) => {
          if (event.target === loader && event.propertyName === "transform") finish();
        },
        { once: true }
      );
      loader.classList.add("is-leave");
      setTimeout(finish, 700);
    });
  }

  function warmHeroVideo() {
    const video = document.querySelector(".hero-video");
    if (!video) return;
    try {
      video.preload = "auto";
      const play = video.play();
      if (play && typeof play.catch === "function") play.catch(() => {});
    } catch {
      /* ignore */
    }
  }

  function finishCover() {
    busy = true;
    slideAway().then(() => {
      hideLoader();
      busy = false;
      warmHeroVideo();
    });
  }

  function playIntro() {
    if (busy) return;
    busy = true;
    showLoader();
    drawRing = mountRing();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      busy = false;
      finishCover();
    };
    const failsafe = setTimeout(finish, 1200);
    animateCount(480).then(() => {
      clearTimeout(failsafe);
      finish();
    });
  }

  function openPage() {
    if (!loader || reduced) {
      hideLoader();
      warmHeroVideo();
      return;
    }

    // In-site navigation: never show the loading screen.
    if (arriving || navType() === "back_forward") {
      hideLoader();
      warmHeroVideo();
      return;
    }

    // First visit or refresh only.
    playIntro();
  }

  function internalPage(anchor, event) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:")) {
      return false;
    }
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return false;
    }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) return false;
    return true;
  }

  // Mark internal navigations so the next page skips the loader. Do not intercept.
  document.addEventListener(
    "click",
    (event) => {
      const anchor = event.target.closest?.("a");
      if (!anchor || !internalPage(anchor, event)) return;
      markNav();
    },
    true
  );

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    busy = false;
    hideLoader();
  });

  openPage();

  function setupMenu() {
    const topbar = document.querySelector(".topbar");
    const menuToggle = document.querySelector(".menu-toggle");
    const siteMenu = document.querySelector("#site-menu");
    if (!topbar || !menuToggle || !siteMenu) return;

    function setMenu(open) {
      topbar.classList.toggle("is-open", open);
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.documentElement.classList.toggle("menu-open", open);
      const label = menuToggle.querySelector(".menu-label");
      if (label) label.textContent = open ? "Close" : "Menu";
    }

    menuToggle.addEventListener("click", () => {
      setMenu(!topbar.classList.contains("is-open"));
    });

    siteMenu.addEventListener("click", (event) => {
      if (event.target === siteMenu || event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenu(false);
    });
  }

  function setupFaq() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const button = item.querySelector(".faq-q");
      if (!button) return;
      button.addEventListener("click", () => {
        const open = !item.classList.contains("is-open");
        item.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  async function hardRefresh() {
    document.body.classList.add("pf-pull-refreshing");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if (navigator.serviceWorker?.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
    } catch (err) {
      console.warn(err);
    }
    const next = new URL(location.href);
    next.searchParams.set("_", String(Date.now()));
    location.replace(next.toString());
  }

  function setupPullToHardRefresh() {
    if (document.body.dataset.pfPull === "off") return;

    let indicator = document.getElementById("pull-refresh-indicator");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = "pull-refresh-indicator";
      indicator.className = "pf-pull-indicator";
      indicator.setAttribute("aria-hidden", "true");
      indicator.innerHTML =
        '<span class="pf-pull-indicator-icon" aria-hidden="true"></span>' +
        '<span class="pf-pull-indicator-label">Pull to refresh</span>';
      document.body.prepend(indicator);
    }

    const THRESHOLD = 96;
    const MAX_PULL = 140;
    let startY = 0;
    let pulling = false;
    let armed = false;
    let triggered = false;

    function scrollTop() {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function setPull(distance) {
      const progress = Math.min(1, distance / THRESHOLD);
      document.body.style.setProperty("--pf-pull", `${Math.min(MAX_PULL, distance)}px`);
      document.body.style.setProperty("--pf-pull-progress", String(progress));
      document.body.classList.toggle("pf-pulling", distance > 8);
      document.body.classList.toggle("pf-pull-ready", distance >= THRESHOLD);
      const label = indicator.querySelector(".pf-pull-indicator-label");
      if (label) {
        label.textContent =
          distance >= THRESHOLD ? "Release to hard refresh" : "Pull to hard refresh";
      }
    }

    function endPull() {
      pulling = false;
      armed = false;
      document.body.classList.remove("pf-pulling", "pf-pull-ready");
      document.body.style.removeProperty("--pf-pull");
      document.body.style.removeProperty("--pf-pull-progress");
    }

    window.addEventListener(
      "touchstart",
      (event) => {
        if (triggered || event.touches.length !== 1 || scrollTop() > 2) return;
        if (document.documentElement.classList.contains("menu-open")) return;
        startY = event.touches[0].clientY;
        pulling = true;
        armed = false;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (event) => {
        if (!pulling || triggered || event.touches.length !== 1) return;
        if (scrollTop() > 2 && !armed) {
          endPull();
          return;
        }
        const delta = event.touches[0].clientY - startY;
        if (delta <= 0) {
          setPull(0);
          return;
        }
        armed = true;
        if (event.cancelable) event.preventDefault();
        setPull(delta * 0.55);
      },
      { passive: false }
    );

    window.addEventListener(
      "touchend",
      () => {
        if (!pulling || triggered) return;
        const distance = Number.parseFloat(document.body.style.getPropertyValue("--pf-pull")) || 0;
        if (distance >= THRESHOLD) {
          triggered = true;
          document.body.classList.add("pf-pull-refreshing");
          void hardRefresh();
          return;
        }
        endPull();
      },
      { passive: true }
    );

    window.addEventListener("touchcancel", endPull, { passive: true });
  }

  function setupPage() {
    setupMenu();
    setupFaq();
    setupPullToHardRefresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupPage);
  else setupPage();
})();
