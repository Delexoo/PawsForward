(function () {
  const params = new URLSearchParams(location.search);
  const code = String(params.get("ref") || params.get("code") || "").trim();

  const els = {
    banner: document.getElementById("status-banner"),
    host: document.getElementById("qr-host"),
    shareUrl: document.getElementById("qr-share-url"),
    code: document.getElementById("qr-code"),
    copy: document.getElementById("qr-copy"),
    download: document.getElementById("qr-download"),
    lead: document.getElementById("qr-lead"),
  };

  function setBanner(msg, kind) {
    if (!els.banner) return;
    if (!msg) {
      els.banner.hidden = true;
      els.banner.textContent = "";
      els.banner.classList.remove("is-ok", "is-err");
      return;
    }
    els.banner.hidden = false;
    els.banner.textContent = msg;
    els.banner.classList.toggle("is-ok", kind === "ok");
    els.banner.classList.toggle("is-err", kind === "err");
  }

  function shareUrlFor(ref) {
    if (typeof window.SITE_CONFIG?.checkoutUrl === "function") {
      return window.SITE_CONFIG.checkoutUrl(ref);
    }
    const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
    if (origin && ref) return `${origin}/donate?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/donate?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/donate` : new URL("/donate", location.origin).href;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!code) {
      setBanner("Missing referral code. Open this page from your signup link.", "err");
      if (els.lead) els.lead.textContent = "Create a QR on Get your QR, then use the link shown there.";
      return;
    }

    const url = shareUrlFor(code);
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.code) els.code.textContent = code;

    try {
      await window.PfQr.renderInto(els.host, url, 260);
    } catch (err) {
      console.error(err);
      setBanner("Could not draw the QR. Copy your link below instead.", "err");
    }

    els.copy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        setBanner("Link copied.", "ok");
      } catch {
        els.shareUrl?.select();
        setBanner("Select and copy the link.", "err");
      }
    });

    els.download?.addEventListener("click", async () => {
      try {
        const dataUrl = await window.PfQr.toDataURL(url, 512);
        window.PfQr.downloadDataUrl(dataUrl, `pawsforward-${code}.png`);
      } catch (err) {
        console.error(err);
        setBanner("Could not download QR.", "err");
      }
    });
  });
})();
