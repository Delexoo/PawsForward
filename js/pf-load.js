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

  const arriving = readNav() || document.documentElement.classList.contains("pf-nav-in");
  clearNav();
  document.documentElement.classList.remove("pf-nav-in");

  const drawRing = mountRing();
  let busy = false;
  let leaving = false;
  let pendingHref = "";

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  function setProgress(value) {
    const next = Math.max(0, Math.min(100, value));
    if (count) count.textContent = `${Math.round(next)}%`;
    drawRing(next);
  }

  let countRun = 0;

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
      setTimeout(finish, 1300);
    });
  }

  function showLoader() {
    if (!loader) return;
    loader.classList.remove("is-done", "is-leave");
    document.documentElement.style.overflow = "hidden";
  }

  function hideLoader() {
    if (!loader) return;
    loader.classList.add("is-done");
    document.documentElement.style.overflow = "";
  }

  function go(href) {
    if (!href || leaving) return;
    leaving = true;
    markNav();
    location.assign(href);
  }

  function finishCover() {
    if (pendingHref) {
      go(pendingHref);
      return;
    }
    busy = true;
    slideAway().then(() => {
      hideLoader();
      busy = false;
      if (pendingHref) go(pendingHref);
    });
  }

  function playOnce(done) {
    if (busy || leaving) return;
    busy = true;
    showLoader();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      busy = false;
      done();
    };
    const failsafe = setTimeout(finish, 1600);
    animateCount(700).then(() => {
      clearTimeout(failsafe);
      finish();
    });
  }

  function openPage() {
    if (!loader || reduced) {
      hideLoader();
      return;
    }

    if (arriving) {
      // Continue from the previous page's cover — no 0% flash.
      showLoader();
      setProgress(100);
      busy = true;
      requestAnimationFrame(() => {
        slideAway().then(() => {
          hideLoader();
          busy = false;
        });
      });
      return;
    }

    playOnce(finishCover);
  }

  function internalPage(anchor, event) {
    if (event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:")) return false;
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return false;
    }
    if (url.origin !== location.origin) return false;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (url.hash) return false;
      return false;
    }
    return true;
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest?.("a");
    if (!anchor) return;
    if (reduced || !internalPage(anchor, event)) return;
    event.preventDefault();
    pendingHref = anchor.href;
    if (leaving) return;
    if (busy) return;
    // Cover, hit 100%, then navigate so the next page can slide away cleanly.
    playOnce(() => {
      if (pendingHref) go(pendingHref);
    });
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    pendingHref = "";
    busy = false;
    leaving = false;
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

  function setupPage() {
    setupMenu();
    setupFaq();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupPage);
  else setupPage();
})();
