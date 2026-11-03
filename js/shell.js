/**
 * PawsForward shell — sidebar chrome on every app page.
 */
(function (global) {
  "use strict";

  const SIDEBAR_WIDTH_KEY = "pf_sidebar_width_v1";
  const SIDEBAR_COLLAPSED_KEY = "pf_sidebar_collapsed_v1";
  const SIDEBAR_WIDTH_DEFAULT = 280;
  const SIDEBAR_WIDTH_MIN = 220;
  const SIDEBAR_WIDTH_MAX = 420;

  function ico(name, cls) {
    return global.SiteIcons?.icon?.(name, cls) || "";
  }

  function isMobileNav() {
    return window.matchMedia("(max-width: 900px)").matches;
  }

  function clampSidebarWidth(width) {
    const n = Number(width);
    if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(n)));
  }

  function loadSidebarWidth() {
    try {
      return clampSidebarWidth(localStorage.getItem(SIDEBAR_WIDTH_KEY) || SIDEBAR_WIDTH_DEFAULT);
    } catch {
      return SIDEBAR_WIDTH_DEFAULT;
    }
  }

  function saveSidebarWidth(width) {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
    } catch {
      /* ignore */
    }
  }

  function applySidebarWidth(width) {
    document.documentElement.style.setProperty("--sidebar", `${clampSidebarWidth(width)}px`);
  }

  function loadSidebarCollapsed() {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function saveSidebarCollapsed(collapsed) {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  function setDesktopSidebarCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }

  function setMenuBtnIcon(btn, menuOpen) {
    const nextIcon = ico(menuOpen ? "chevron-left" : "chevron-right", "ico-menu");
    const currentIcon = btn.querySelector(".ico-menu");
    if (currentIcon) currentIcon.outerHTML = nextIcon;
    else btn.insertAdjacentHTML("afterbegin", nextIcon);
  }

  function syncMenuBtnState(btn, sidebar, overlay) {
    if (!btn) return;
    if (isMobileNav()) {
      document.body.classList.remove("sidebar-collapsed");
      const open = sidebar?.classList.contains("open");
      setMenuBtnIcon(btn, open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      return;
    }
    sidebar?.classList.remove("open");
    overlay?.classList.remove("open");
    const collapsed = document.body.classList.contains("sidebar-collapsed");
    setMenuBtnIcon(btn, !collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.setAttribute("aria-label", collapsed ? "Open menu" : "Close menu");
  }

  function ensurePageLayout() {
    const shell = document.getElementById("shell");
    const slot = document.getElementById("page-body");
    if (!shell || !slot) return null;

    let main = document.getElementById("main-content");
    if (!main) {
      main = document.createElement("main");
      main.className = "main";
      main.id = "main-content";
      shell.appendChild(main);
    }
    if (slot.parentElement !== main) {
      main.appendChild(slot);
    }
    return main;
  }

  function navItem(href, label, icon, active, extraAttrs) {
    const cls = active ? "nav-link active" : "nav-link";
    return (
      `<li><a class="${cls}" href="${href}" ${extraAttrs || ""}>` +
      `${ico(icon, "ico-nav")}<span class="nav-link-text">${label}</span>` +
      `</a></li>`
    );
  }

  function detectActiveId(explicit) {
    if (explicit) return explicit;
    const page = document.body?.getAttribute("data-page") || "";
    if (page === "donate") return "donate";
    if (page === "privacy") return "privacy";
    if (page === "terms") return "terms";
    if (page === "login") return "login";
    const hash = (location.hash || "").replace("#", "");
    if (hash === "donations" || hash === "employees" || hash === "geography" || hash === "overview") {
      return hash;
    }
    return "overview";
  }

  function brandSub(activeId) {
    if (activeId === "donate") return "Donate";
    if (activeId === "privacy") return "Privacy";
    if (activeId === "terms") return "Terms";
    if (activeId === "login") return "Sign in";
    return "Admin console";
  }

  function initSidebarResizer(handle) {
    if (!handle) return;
    const onPointerDown = (event) => {
      if (isMobileNav()) return;
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      document.body.classList.add("sidebar-resizing");
      setDesktopSidebarCollapsed(false);
      saveSidebarCollapsed(false);
      syncMenuBtnState(
        document.getElementById("menu-btn"),
        document.getElementById("sidebar"),
        document.getElementById("sidebar-overlay")
      );

      const onPointerMove = (moveEvent) => applySidebarWidth(moveEvent.clientX);
      const onPointerUp = (upEvent) => {
        saveSidebarWidth(upEvent.clientX);
        document.body.classList.remove("sidebar-resizing");
        handle.releasePointerCapture?.(upEvent.pointerId);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("dblclick", () => {
      applySidebarWidth(SIDEBAR_WIDTH_DEFAULT);
      saveSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
    });
  }

  function renderShell(activeId) {
    const appName = global.SITE_CONFIG?.appName || "PawsForward";
    const shell = document.getElementById("shell");
    if (!shell) return;
    if (document.getElementById("sidebar")) return;

    document.body.classList.add("site-unlocked");
    document.body.removeAttribute("data-public");

    const active = detectActiveId(activeId);
    ensurePageLayout();
    applySidebarWidth(loadSidebarWidth());
    const main = document.getElementById("main-content");

    const chrome = document.createRange().createContextualFragment(
      `<div class="sidebar-overlay" id="sidebar-overlay"></div>` +
        `<aside class="sidebar" id="sidebar">` +
        `<div class="sidebar-panel">` +
        `<a class="brand" href="admin.html" aria-label="Go to Admin console">` +
        `<span class="brand-mark" aria-hidden="true">PF</span>` +
        `<span class="brand-text"><strong>${appName}</strong><span class="brand-sub">${brandSub(active)}</span></span>` +
        `</a>` +
        `<div class="nav-group nav-group-home" data-nav-group="overview">` +
        `<ul class="nav-list nav-list-standalone">` +
        navItem("admin.html#overview", "Overview", "layout-dashboard", active === "overview") +
        navItem("admin.html#donations", "Donations", "banknote", active === "donations") +
        navItem("admin.html#employees", "Employees", "users", active === "employees") +
        navItem("admin.html#geography", "Geography", "globe", active === "geography") +
        navItem("donate.html", "Donate", "heart", active === "donate") +
        navItem("privacy.html", "Privacy", "help-circle", active === "privacy") +
        navItem("terms.html", "Terms", "info", active === "terms") +
        `</ul></div>` +
        `<p class="sidebar-foot">Every dollar helps dogs in need of food, water, and shelter.</p>` +
        `</div>` +
        `<button type="button" class="sidebar-resize-handle" id="sidebar-resize-handle" aria-label="Resize sidebar" title="Drag to resize sidebar"></button>` +
        `<button type="button" class="menu-btn" id="menu-btn" aria-label="Open menu" aria-controls="sidebar" aria-expanded="true">${ico("chevron-left", "ico-menu")}<span>Menu</span></button>` +
        `</aside>`
    );
    shell.insertBefore(chrome, main);

    const btn = document.getElementById("menu-btn");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const close = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
      syncMenuBtnState(btn, sidebar, overlay);
    };

    if (!isMobileNav() && loadSidebarCollapsed()) {
      setDesktopSidebarCollapsed(true);
    }
    syncMenuBtnState(btn, sidebar, overlay);

    btn.addEventListener("click", () => {
      if (isMobileNav()) {
        const open = !sidebar.classList.contains("open");
        sidebar.classList.toggle("open", open);
        overlay.classList.toggle("open", open);
        syncMenuBtnState(btn, sidebar, overlay);
        return;
      }
      const collapsed = !document.body.classList.contains("sidebar-collapsed");
      setDesktopSidebarCollapsed(collapsed);
      saveSidebarCollapsed(collapsed);
      syncMenuBtnState(btn, sidebar, overlay);
    });
    overlay.addEventListener("click", close);
    sidebar.querySelectorAll(".nav-link, .brand").forEach((a) => a.addEventListener("click", close));
    initSidebarResizer(document.getElementById("sidebar-resize-handle"));

    if (!global.__pfSidebarResizeBound) {
      global.__pfSidebarResizeBound = true;
      window.addEventListener("resize", () => {
        const menuBtn = document.getElementById("menu-btn");
        const side = document.getElementById("sidebar");
        const over = document.getElementById("sidebar-overlay");
        if (isMobileNav()) setDesktopSidebarCollapsed(false);
        else if (loadSidebarCollapsed()) setDesktopSidebarCollapsed(true);
        else setDesktopSidebarCollapsed(false);
        syncMenuBtnState(menuBtn, side, over);
      });
    }

    global.SiteIcons?.initIcons?.();
  }

  global.PfShell = { renderShell };
})(window);
