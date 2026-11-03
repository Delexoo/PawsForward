(function (global) {
  let deferredPrompt = null;

  function isStandalone() {
    return (
      global.matchMedia?.("(display-mode: standalone)")?.matches ||
      global.navigator?.standalone === true ||
      document.referrer.includes("android-app://")
    );
  }

  function isIos() {
    const ua = global.navigator?.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (global.navigator?.platform === "MacIntel" && global.navigator?.maxTouchPoints > 1);
  }

  function init(options = {}) {
    const btn = options.button || document.getElementById("btn-install");
    const dialog = options.dialog || document.getElementById("install-dialog");
    const closeBtn = options.closeBtn || document.getElementById("install-close");
    const status = typeof options.status === "function" ? options.status : null;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.warn("Service worker registration failed", err);
      });
    }

    if (!btn) return;

    if (isStandalone()) {
      btn.hidden = true;
      return;
    }

    btn.hidden = false;

    global.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btn.hidden = false;
      btn.textContent = "Install";
    });

    global.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      btn.hidden = true;
      status?.("App installed. You can open it from your home screen.", "ok");
    });

    closeBtn?.addEventListener("click", () => dialog?.close());

    btn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          const choice = await deferredPrompt.userChoice;
          if (choice?.outcome === "accepted") {
            status?.("Installing…", "ok");
          }
        } catch (err) {
          console.warn(err);
        }
        deferredPrompt = null;
        return;
      }

      if (dialog) {
        const lead = dialog.querySelector("#install-dialog-lead");
        if (lead) {
          lead.textContent = isIos()
            ? "On iPhone/iPad: tap Share, then Add to Home Screen. Use Safari for the best result."
            : "Use your browser menu → Install app or Add to Home screen. Chrome/Edge on Android and desktop support one-tap install.";
        }
        dialog.showModal();
        return;
      }

      status?.(
        isIos()
          ? "Tap Share → Add to Home Screen to install."
          : "Use your browser menu to Install app / Add to Home screen.",
        "ok"
      );
    });
  }

  global.PfInstall = { init };
})(window);
