(function () {
  const STORAGE_KEY = "pf-created-qr";
  const PAYMENT_LABELS = {
    cashapp: "Cash App",
    venmo: "Venmo",
    paypal: "PayPal",
    apple_pay: "Apple Pay",
    other: "Other",
  };

  const els = {
    ready: document.getElementById("created-ready"),
    empty: document.getElementById("created-empty"),
    title: document.getElementById("created-title"),
    instructions: document.getElementById("created-instructions"),
    banner: document.getElementById("status-banner"),
    qr: document.getElementById("created-qr"),
    shareUrl: document.getElementById("created-share-url"),
    details: document.getElementById("created-details"),
    mail: document.getElementById("created-mail"),
    copy: document.getElementById("created-copy"),
    print: document.getElementById("created-print"),
    download: document.getElementById("created-download"),
    share: document.getElementById("created-share"),
  };

  let current = { url: "", code: "", email: "", name: "" };

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

  function isLocalHost() {
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function siteOrigin() {
    if (isLocalHost()) return location.origin.replace(/\/$/, "");
    return String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
  }

  function publicSiteOrigin() {
    return (
      String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "") ||
      "https://joinpawsforward.com"
    );
  }

  function shareUrlFor(code) {
    const origin = siteOrigin() || location.origin.replace(/\/$/, "");
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/donate?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/donate?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/donate` : new URL("/donate", location.origin).href;
  }

  function qrPageUrlFor(code) {
    const origin = siteOrigin() || location.origin.replace(/\/$/, "");
    const ref = String(code || "").trim();
    if (origin && ref) return `${origin}/qr?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/qr?ref=${encodeURIComponent(ref)}`, location.origin).href;
    return origin ? `${origin}/qr` : new URL("/qr", location.origin).href;
  }

  function commissionLabel() {
    const rate = Number(window.SITE_CONFIG?.commissionRate ?? 0.5);
    const pct = Number.isFinite(rate) ? Math.round(rate * 100) : 50;
    return `${pct}%`;
  }

  function paymentLabel(type) {
    const key = String(type || "").trim().toLowerCase();
    if (!key) return "";
    if (PAYMENT_LABELS[key]) return PAYMENT_LABELS[key];
    return key.replace(/_/g, " ");
  }

  function readStored() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch {
      return null;
    }
  }

  function saveStored(record) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* ignore */
    }
  }

  function addDetail(label, value) {
    const text = String(value || "").trim();
    if (!text || text === "-" || !els.details) return;
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = text;
    row.append(dt, dd);
    els.details.appendChild(row);
  }

  function showEmpty() {
    if (els.ready) els.ready.hidden = true;
    if (els.empty) els.empty.hidden = false;
  }

  function shareText() {
    return "Help this dog charity, donate any amount here:";
  }

  async function emailWelcome(record) {
    if (!record.email || !record.code) return { ok: false };
    const apiOrigin = publicSiteOrigin();
    const linkOrigin = siteOrigin() || apiOrigin;
    try {
      const res = await fetch(`${apiOrigin}/api/send-promoter-welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: record.email,
          referral_code: record.code,
          share_url: record.url || `${apiOrigin}/donate?ref=${encodeURIComponent(record.code)}`,
          qr_page_url: record.qrPage || `${apiOrigin}/qr?ref=${encodeURIComponent(record.code)}`,
          site_origin: apiOrigin,
          link_origin: linkOrigin,
        }),
      });
      if (!res.ok) return { ok: false };
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  async function showReady(record) {
    const code = String(record.code || "").trim();
    const url = String(record.url || shareUrlFor(code)).trim();
    const name = String(record.name || "").trim();
    current = { url, code, email: String(record.email || "").trim(), name };

    if (els.empty) els.empty.hidden = true;
    if (els.ready) els.ready.hidden = false;
    if (els.title) els.title.textContent = name ? `Your QR is ready, ${name}.` : "Your QR is ready.";
    if (els.instructions) {
      els.instructions.textContent =
        `You have created your referral QR code. Feel free to print or share this QR code so people can donate to our charity, and you earn ${commissionLabel()} of every gift.`;
    }
    if (els.shareUrl) els.shareUrl.value = url;
    if (els.mail) {
      els.mail.hidden = !current.email;
    }

    addDetail("Name", name);
    addDetail("Email", record.email);
    addDetail("Phone", record.phone);
    addDetail("Payment type", paymentLabel(record.paymentType));
    addDetail("Payout", record.paymentHandle);
    addDetail("Referral code", code);

    try {
      await window.PfQr.renderInto(els.qr, url, 240);
    } catch (err) {
      console.error(err);
      setBanner("Your QR was created. The image failed to draw — use the donation link below.", "err");
    }

    if (current.email && !record.welcomeSent) {
      const mailed = await emailWelcome({ ...record, url, qrPage: record.qrPage || qrPageUrlFor(code) });
      if (mailed.ok) {
        record.welcomeSent = true;
        saveStored(record);
        setBanner(`You’re set. We also emailed ${current.email}.`, "ok");
      }
    }
    if (current.email && !record.accountSent) {
      const account = await sendAccountEmail(current.email);
      if (account.ok && account.sent) {
        record.accountSent = true;
        saveStored(record);
        setBanner(`You’re set. We emailed ${current.email} a sign-in code.`, "ok");
      }
    }
  }

  async function sendAccountEmail(email) {
    const cfg = window.SITE_CONFIG || {};
    const base = String(cfg.supabaseUrl || "").replace(/\/$/, "");
    const key = String(cfg.supabaseAnonKey || "");
    if (!base || !key || !email) return { ok: false };
    try {
      const res = await fetch(`${base}/functions/v1/promoter-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({ email, site_origin: cfg.siteOrigin || location.origin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false };
      return { ok: true, sent: body.sent !== false };
    } catch {
      return { ok: false };
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const queryCode = String(params.get("ref") || params.get("code") || "").trim();
    const stored = readStored();
    const storedCode = String(stored?.code || "").trim();
    const record = storedCode ? stored : null;

    if (!record && !queryCode) {
      showEmpty();
      return;
    }

    if (record) {
      await showReady(record);
      return;
    }

    await showReady({
      code: queryCode,
      url: shareUrlFor(queryCode),
      qrPage: qrPageUrlFor(queryCode),
    });
  });

  els.copy?.addEventListener("click", async () => {
    if (!current.url) return;
    try {
      await navigator.clipboard.writeText(current.url);
      setBanner("Donation link copied.", "ok");
    } catch {
      els.shareUrl?.select();
      setBanner("Could not copy automatically — select and copy the donation link.", "err");
    }
  });

  els.print?.addEventListener("click", () => {
    window.print();
  });

  els.download?.addEventListener("click", async () => {
    if (!current.url) return;
    try {
      const dataUrl = await window.PfQr.toDataURL(current.url, 512);
      window.PfQr.downloadDataUrl(dataUrl, `pawsforward-${current.code || "qr"}.png`);
    } catch (err) {
      console.error(err);
      setBanner("Could not download QR.", "err");
    }
  });

  els.share?.addEventListener("click", async () => {
    if (!current.url) return;
    const text = shareText();
    const message = `${text}\n${current.url}`;
    try {
      if (navigator.share) {
        const withUrl = { title: "Help this dog charity", text, url: current.url };
        const canSeparate = !navigator.canShare || navigator.canShare(withUrl);
        await navigator.share(canSeparate ? withUrl : { title: "Help this dog charity", text: message });
        setBanner("Share sheet opened.", "ok");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return;
      console.warn(err);
    }
    try {
      await navigator.clipboard.writeText(message);
      setBanner("Share message copied — paste it anywhere.", "ok");
    } catch {
      setBanner("Could not share — copy your donation link instead.", "err");
    }
  });
})();
