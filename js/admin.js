(function () {
  const COMMISSION = () => Number(window.SITE_CONFIG?.commissionRate ?? 0.5);
  const CACHE_KEY = "pf_admin_cache_v2";

  const els = {
    skeleton: document.getElementById("dashboard-skeleton"),
    content: document.getElementById("dashboard-content"),
    totalDonors: document.getElementById("stat-total-donors"),
    donors24h: document.getElementById("stat-donors-24h"),
    totalDonated: document.getElementById("stat-total-donated"),
    totalOwed: document.getElementById("stat-total-owed"),
    totalVisits: document.getElementById("stat-total-visits"),
    employeesBody: document.getElementById("employees-body"),
    employeesEmpty: document.getElementById("employees-empty"),
    donationsFeed: document.getElementById("donations-feed"),
    donationsEmpty: document.getElementById("donations-empty"),
    geoChart: document.getElementById("geo-chart"),
    geoEmpty: document.getElementById("geo-empty"),
    employeeDialog: document.getElementById("employee-dialog"),
    employeeForm: document.getElementById("employee-form"),
    employeeTitle: document.getElementById("employee-dialog-title"),
    employeeLead: document.getElementById("employee-dialog-lead"),
    employeeCancel: document.getElementById("employee-cancel"),
    employeeSubmit: document.getElementById("employee-submit"),
    empId: document.getElementById("emp-id"),
    empFirst: document.getElementById("emp-first"),
    empLast: document.getElementById("emp-last"),
    empPhone: document.getElementById("emp-phone"),
    empPayment: document.getElementById("emp-payment"),
    empPaymentHandle: document.getElementById("emp-payment-handle"),
    empPaymentHandleLabel: document.getElementById("emp-payment-handle-label"),
    empAvatarPreview: document.getElementById("emp-avatar-preview"),
    empAvatarFile: document.getElementById("emp-avatar-file"),
    empAvatarReset: document.getElementById("emp-avatar-reset"),
    btnNew: document.getElementById("btn-new-employee"),
    btnPlaceholders: document.getElementById("btn-add-placeholders"),
    pullIndicator: document.getElementById("pull-refresh-indicator"),
    inboxCountHint: document.getElementById("inbox-count-hint"),
    dock: document.querySelector(".pf-dock"),
    errFirst: document.getElementById("err-emp-first"),
    errLast: document.getElementById("err-emp-last"),
    errPhone: document.getElementById("err-emp-phone"),
    errPayment: document.getElementById("err-emp-payment"),
    errHandle: document.getElementById("err-emp-handle"),
    qrDialog: document.getElementById("qr-dialog"),
    qrLead: document.getElementById("qr-dialog-lead"),
    qrHost: document.getElementById("qr-canvas-host"),
    qrLinkText: document.getElementById("qr-link-text"),
    qrCopy: document.getElementById("qr-copy-link"),
    qrDownload: document.getElementById("qr-download"),
    qrClose: document.getElementById("qr-close"),
    visitsDialog: document.getElementById("visits-dialog"),
    visitsTitle: document.getElementById("visits-dialog-title"),
    visitsLead: document.getElementById("visits-dialog-lead"),
    visitsList: document.getElementById("visits-dialog-list"),
    visitsEmpty: document.getElementById("visits-dialog-empty"),
    visitsClose: document.getElementById("visits-dialog-close"),
    confirmDialog: document.getElementById("confirm-dialog"),
    confirmTitle: document.getElementById("confirm-dialog-title"),
    confirmLead: document.getElementById("confirm-dialog-lead"),
    confirmCancel: document.getElementById("confirm-cancel"),
    confirmOk: document.getElementById("confirm-ok"),
    detailDialog: document.getElementById("employee-detail-dialog"),
    detailTitle: document.getElementById("employee-detail-title"),
    detailPhone: document.getElementById("employee-detail-phone"),
    detailAvatar: document.getElementById("detail-avatar"),
    detailVisits: document.getElementById("detail-visits"),
    detailRaised: document.getElementById("detail-raised"),
    detailOwed: document.getElementById("detail-owed"),
    detailPaid: document.getElementById("detail-paid"),
    detailClose: document.getElementById("employee-detail-close"),
    detailAvatarFile: document.getElementById("detail-avatar-file"),
    statsGrid: document.getElementById("stats-grid"),
    statInfoDialog: document.getElementById("stat-info-dialog"),
    statInfoTitle: document.getElementById("stat-info-title"),
    statInfoLead: document.getElementById("stat-info-lead"),
    statInfoList: document.getElementById("stat-info-list"),
    statInfoClose: document.getElementById("stat-info-close"),
    payoutDialog: document.getElementById("payout-dialog"),
    payoutForm: document.getElementById("payout-form"),
    payoutTitle: document.getElementById("payout-dialog-title"),
    payoutLead: document.getElementById("payout-dialog-lead"),
    payoutSummary: document.getElementById("payout-summary"),
    payoutCancel: document.getElementById("payout-cancel"),
    payoutSubmit: document.getElementById("payout-submit"),
    payEmployeeId: document.getElementById("pay-employee-id"),
    payAmount: document.getElementById("pay-amount"),
    payNote: document.getElementById("pay-note"),
    errPayAmount: document.getElementById("err-pay-amount"),
    donationDialog: document.getElementById("donation-dialog"),
    donationForm: document.getElementById("donation-form"),
    donationTitle: document.getElementById("donation-dialog-title"),
    donationLead: document.getElementById("donation-dialog-lead"),
    donationCancel: document.getElementById("donation-cancel"),
    donationSubmit: document.getElementById("donation-submit"),
    donId: document.getElementById("don-id"),
    donAmount: document.getElementById("don-amount"),
    donDonor: document.getElementById("don-donor"),
    donEmployee: document.getElementById("don-employee"),
    errDonAmount: document.getElementById("err-don-amount"),
  };

  const DEFAULT_AVATAR = "doc/default-avatar.jpg";
  const AVATAR_BUCKET = "employee-avatars";

  let currentQr = { url: "", name: "" };
  let latestEmployees = [];
  let latestDonations = [];
  let latestPayouts = [];
  let latestVisits = [];
  let latestVisitStats = {};
  let latestDonationStats = {};
  let latestPaidByEmployee = {};
  let latestSnapshot = {
    donors: 0,
    donors24h: 0,
    raised: 0,
    attributedRaised: 0,
    paid: 0,
    owed: 0,
    visits: 0,
  };
  let detailEmployee = null;
  let payoutEmployee = null;
  let editingDonationId = null;
  let editingEmployeeId = null;
  let pendingAvatarFile = null;
  let pendingAvatarReset = false;
  const ADMIN_PAGE_KEY = "pf_admin_page_v1";

  const ADMIN_PAGES = ["dashboard", "employees", "donations", "settings"];
  const SETTINGS_KEY = "pf_admin_settings_v1";
  const DEFAULT_SETTINGS = {
    notifyQrCreated: true,
    notifyQrScanned: true,
    notifyDonation: false,
    notifySound: false,
    confirmDeletes: true,
    autoRefresh: true,
    autoLogin: false,
  };
  let alertsPrimed = false;
  let statusIsAlert = false;
  let notifyNudgeShown = false;
  const seenEmployeeIds = new Set();
  const seenVisitIds = new Set();
  const seenDonationIds = new Set();
  let alertTimer = 0;
  let alertAudio = null;
  let adminPageBusy = false;

  function normalizeAdminPage(pageId) {
    if (pageId === "inbox") return "donations";
    if (pageId === "activity") return "dashboard";
    return ADMIN_PAGES.includes(pageId) ? pageId : "dashboard";
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  let dockIndicatorReady = false;

  function moveDockIndicator(animate) {
    const tabs = document.querySelector(".pf-dock-tabs");
    const active = tabs?.querySelector(".pf-dock-tab.is-active");
    if (!tabs || !active) return;
    let indicator = tabs.querySelector(".pf-dock-indicator");
    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "pf-dock-indicator";
      indicator.setAttribute("aria-hidden", "true");
      tabs.prepend(indicator);
    }
    const shouldAnimate = animate && dockIndicatorReady && !prefersReducedMotion();
    if (!shouldAnimate) indicator.style.transition = "none";
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.height = `${active.offsetHeight}px`;
    indicator.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
    if (!shouldAnimate) {
      indicator.getBoundingClientRect();
      indicator.style.transition = "";
    }
    tabs.classList.add("is-ready");
    dockIndicatorReady = true;
    fitPanelsAboveDock(tabs.closest(".pf-dock"));
  }

  function fitPanelsAboveDock(dock) {
    const bar = dock || document.querySelector(".pf-dock");
    if (!bar) return;
    const dockTop = bar.getBoundingClientRect().top;
    if (dockTop < 48) return;
    const gap = 8;
    const rootBottom = document.documentElement.getBoundingClientRect().bottom;
    const space = Math.ceil(rootBottom - dockTop + gap);
    if (space > 48 && space < rootBottom) {
      const nextSpace = `${space}px`;
      if (document.body.style.getPropertyValue("--pf-dock-space") !== nextSpace) {
        document.body.style.setProperty("--pf-dock-space", nextSpace);
      }
    }
    const panel = document.querySelector(
      ".pf-admin-page.is-active:not([hidden]):not(.is-enter):not(.is-exit)"
    );
    if (!panel) return;
    const panelTop = panel.getBoundingClientRect().top;
    const max = Math.floor(dockTop - panelTop - gap);
    if (max > 160) {
      const nextMax = `${max}px`;
      if (document.body.style.getPropertyValue("--pf-panel-max") !== nextMax) {
        document.body.style.setProperty("--pf-panel-max", nextMax);
      }
    }
  }

  function syncAdminNav(next) {
    document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
      const active = btn.getAttribute("data-admin-nav") === next;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    moveDockIndicator(true);
    try {
      sessionStorage.setItem(ADMIN_PAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function showAdminPageInstant(next) {
    document.querySelectorAll(".pf-admin-page").forEach((panel) => {
      const active = panel.getAttribute("data-admin-page") === next;
      panel.classList.remove("is-enter", "is-exit");
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    syncAdminNav(next);
  }

  async function setAdminPage(pageId, { instant = false } = {}) {
    const next = normalizeAdminPage(pageId);
    const current = document.querySelector(".pf-admin-page.is-active");
    const incoming = document.querySelector(`.pf-admin-page[data-admin-page="${next}"]`);
    if (!incoming) return;
    if (current?.getAttribute("data-admin-page") === next) {
      syncAdminNav(next);
      return;
    }
    if (adminPageBusy) return;

    if (instant || !current || prefersReducedMotion()) {
      showAdminPageInstant(next);
      if (next === "settings") void onSettingsOpened();
      return;
    }

    adminPageBusy = true;
    syncAdminNav(next);
    document.querySelectorAll(".pf-admin-page").forEach((panel) => {
      if (panel === current || panel === incoming) return;
      panel.hidden = true;
      panel.classList.remove("is-active", "is-enter", "is-exit", "is-back");
    });

    const order = ADMIN_PAGES;
    const forward = order.indexOf(next) >= order.indexOf(current.getAttribute("data-admin-page"));
    current.classList.toggle("is-back", !forward);
    incoming.classList.toggle("is-back", !forward);
    current.classList.add("is-exit");
    current.classList.remove("is-active", "is-enter");
    incoming.hidden = false;
    incoming.classList.add("is-enter");
    incoming.classList.remove("is-exit", "is-active");

    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });

    current.hidden = true;
    current.classList.remove("is-exit", "is-back");
    incoming.classList.add("is-active");
    incoming.classList.remove("is-enter", "is-back");
    adminPageBusy = false;
    requestAnimationFrame(() => fitPanelsAboveDock());
    if (next === "settings") void onSettingsOpened();
  }

  function wireAdminNav() {
    document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = btn.getAttribute("data-admin-nav");
        if (page === "settings") {
          const settings = readSettings();
          const wants = settings.notifyQrCreated || settings.notifyQrScanned || settings.notifyDonation;
          if (wants) void ensureNotifyPermission();
        }
        setAdminPage(page);
      });
    });
    let initial = "dashboard";
    try {
      initial = sessionStorage.getItem(ADMIN_PAGE_KEY) || "dashboard";
    } catch {
      /* ignore */
    }
    setAdminPage(normalizeAdminPage(initial), { instant: true });
    const tabs = document.querySelector(".pf-dock-tabs");
    const refit = () => moveDockIndicator(false);
    if (tabs && window.ResizeObserver) {
      const observer = new ResizeObserver(refit);
      observer.observe(tabs);
    } else {
      window.addEventListener("resize", refit);
    }
    window.visualViewport?.addEventListener("resize", refit);
    window.visualViewport?.addEventListener("scroll", refit);
  }

  function readSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function writeSettings(next) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function applySettingsForm() {
    const settings = readSettings();
    document.querySelectorAll("[data-setting]").forEach((input) => {
      const key = input.getAttribute("data-setting");
      input.checked = Boolean(settings[key]);
    });
  }

  async function ensureNotifyPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      const result = await Notification.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }

  function playAlertSound() {
    if (!readSettings().notifySound) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!alertAudio) alertAudio = new Ctx();
      const start = () => {
        const osc = alertAudio.createOscillator();
        const gain = alertAudio.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.05, alertAudio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, alertAudio.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(alertAudio.destination);
        osc.start();
        osc.stop(alertAudio.currentTime + 0.2);
      };
      if (alertAudio.state === "suspended") {
        alertAudio.resume().then(start).catch(() => {});
        return;
      }
      start();
    } catch {
      /* ignore */
    }
  }

  function registerAlertWorker() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn(err);
      return null;
    });
  }

  async function showSystemAlert(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const options = {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon.png",
      tag: tag || title,
      renotify: true,
      data: { url: "/admin" },
    };
    try {
      if ("serviceWorker" in navigator) {
        const reg = (await navigator.serviceWorker.getRegistration()) || (await registerAlertWorker());
        const active = reg?.active ? reg : reg ? await navigator.serviceWorker.ready : null;
        if (active?.showNotification) {
          try {
            await active.showNotification(title, options);
          } catch (err) {
            const plain = { ...options };
            delete plain.renotify;
            await active.showNotification(title, plain);
          }
          return;
        }
      }
    } catch (err) {
      console.warn(err);
    }
    try {
      const note = new Notification(title, options);
      note.onclick = () => {
        window.focus();
        note.close();
      };
    } catch (err) {
      console.warn(err);
    }
  }

  function pushAlert(title, body, tag) {
    playAlertSound();
    void showSystemAlert(title, body, tag);
  }

  function maybeNudgeNotifications() {
    if (notifyNudgeShown || statusIsAlert) return;
    const settings = readSettings();
    const wants = settings.notifyQrCreated || settings.notifyQrScanned || settings.notifyDonation;
    if (!wants || !("Notification" in window) || Notification.permission === "granted") return;
    notifyNudgeShown = true;
    const el = document.getElementById("admin-status");
    if (Notification.permission === "denied") {
      setBanner("Notifications are blocked. Allow them for this site in the browser settings.", "err");
      return;
    }
    setBanner("Tap this message to allow QR alerts on this device.", "info");
    el?.classList.add("is-action");
  }

  function visitKeys(visit) {
    const keys = [`row:${visit?.created_at}|${visit?.referral_code}|${visit?.employee_id}|${visit?.city}`];
    if (visit?.id) keys.push(`id:${visit.id}`);
    return keys;
  }

  function rememberVisit(visit) {
    visitKeys(visit).forEach((key) => seenVisitIds.add(key));
  }

  function visitIsNew(visit) {
    if (visit?.id) return !seenVisitIds.has(`id:${visit.id}`);
    return visitKeys(visit).every((key) => !seenVisitIds.has(key));
  }

  function employeeForRecord(record, employees) {
    return (
      employees.find((emp) => emp.id && emp.id === record.employee_id) ||
      employees.find((emp) => emp.referral_code && emp.referral_code === record.referral_code) ||
      null
    );
  }

  function announceFreshActivity(employees, visits, donations) {
    if (!alertsPrimed) {
      employees.forEach((emp) => emp.id && seenEmployeeIds.add(emp.id));
      visits.forEach((visit) => rememberVisit(visit));
      donations.forEach((donation) => donation.id && seenDonationIds.add(donation.id));
      alertsPrimed = true;
      return;
    }

    const settings = readSettings();
    const freshEmployees = employees.filter((emp) => emp.id && !seenEmployeeIds.has(emp.id));
    const freshVisits = visits.filter((visit) => visitIsNew(visit));
    const freshDonations = donations.filter((donation) => donation.id && !seenDonationIds.has(donation.id));
    freshEmployees.forEach((emp) => seenEmployeeIds.add(emp.id));
    freshVisits.forEach((visit) => rememberVisit(visit));
    freshDonations.forEach((donation) => seenDonationIds.add(donation.id));

    if (settings.notifyQrCreated && freshEmployees.length) {
      if (freshEmployees.length > 3) {
        pushAlert("New QR codes", `${freshEmployees.length} referral QR codes were created.`, "qr-created-batch");
      } else {
        freshEmployees.forEach((emp) => {
          pushAlert("New QR code", `${personLabel(emp)} created a referral QR.`, `qr-${emp.id}`);
        });
      }
    }

    if (settings.notifyQrScanned && freshVisits.length) {
      if (freshVisits.length > 3) {
        pushAlert("QR scans", `${freshVisits.length} QR codes were scanned.`, "qr-scan-batch");
      } else {
        freshVisits.forEach((visit) => {
          const emp = employeeForRecord(visit, employees);
          const who = emp ? `${personLabel(emp)}'s QR` : "A QR code";
          const place = formatPlace(visit);
          const body = place ? `${who} was scanned in ${place}.` : `${who} was scanned.`;
          pushAlert("QR scan", body, `scan-${visitKeys(visit)[0]}`);
        });
      }
    }

    if (settings.notifyDonation && freshDonations.length) {
      if (freshDonations.length > 3) {
        pushAlert("New donations", `${freshDonations.length} gifts came in.`, "donation-batch");
      } else {
        freshDonations.forEach((donation) => {
          const emp = employeeForRecord(donation, employees);
          const who = emp ? ` for ${personLabel(emp)}` : "";
          pushAlert("New donation", `${money(donation.amount)} gift${who}.`, `gift-${donation.id}`);
        });
      }
    }
  }

  function rememberEmployees(rows) {
    (rows || []).forEach((row) => row?.id && seenEmployeeIds.add(row.id));
  }

  function syncAlertPolling() {
    window.clearInterval(alertTimer);
    alertTimer = 0;
    const settings = readSettings();
    const wants =
      settings.autoRefresh ||
      settings.notifyQrCreated ||
      settings.notifyQrScanned ||
      settings.notifyDonation;
    if (!wants) return;
    alertTimer = window.setInterval(() => {
      loadDashboard({ skipCachePaint: true, silent: true });
    }, 20000);
  }

  async function onSettingsOpened() {
    const settings = readSettings();
    const wants = settings.notifyQrCreated || settings.notifyQrScanned || settings.notifyDonation;
    if (wants && "Notification" in window && Notification.permission === "default") {
      await ensureNotifyPermission();
    }
  }

  function wireSettings() {
    applySettingsForm();
    document.getElementById("settings")?.addEventListener("change", async (event) => {
      const input = event.target.closest?.("[data-setting]");
      if (!input) return;
      const key = input.getAttribute("data-setting");
      const settings = readSettings();
      const isAlert = key === "notifyQrCreated" || key === "notifyQrScanned" || key === "notifyDonation";
      const hadPermission = "Notification" in window && Notification.permission === "granted";
      if (input.checked && isAlert) {
        const allowed = await ensureNotifyPermission();
        if (!allowed) {
          input.checked = false;
          settings[key] = false;
          writeSettings(settings);
          syncAlertPolling();
          return;
        }
      }
      settings[key] = Boolean(input.checked);
      writeSettings(settings);
      if (key === "autoLogin") {
        if (input.checked) {
          const until = await window.SiteSupabase?.persistAutoSession?.();
          if (!until) {
            input.checked = false;
            settings.autoLogin = false;
            writeSettings(settings);
            setBanner("Sign in again before turning on Bypass PIN.", "err");
          }
        } else {
          window.SiteSupabase?.clearAutoSession?.();
          await window.SitePin?.lock?.();
          location.replace("/login?next=admin");
          return;
        }
      }
      syncAlertPolling();
      if (input.checked && isAlert && !hadPermission && Notification.permission === "granted") {
        pushAlert(
          "Notifications are on",
          "You'll get alerts on this device while the dashboard is open.",
          "notify-enabled"
        );
      }
    });
    document.getElementById("settings-lock-btn")?.addEventListener("click", async () => {
      const settings = readSettings();
      settings.autoLogin = false;
      writeSettings(settings);
      await window.SitePin?.lock?.();
      location.replace("/login");
    });
    document.getElementById("admin-status")?.addEventListener("click", () => {
      if (!("Notification" in window) || Notification.permission !== "default") return;
      void ensureNotifyPermission().then((allowed) => {
        if (allowed) {
          pushAlert(
            "Notifications are on",
            "You'll get alerts on this device while the dashboard is open.",
            "notify-enabled"
          );
        }
      });
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      const settings = readSettings();
      const wants =
        settings.autoRefresh ||
        settings.notifyQrCreated ||
        settings.notifyQrScanned ||
        settings.notifyDonation;
      if (!wants) return;
      loadDashboard({ skipCachePaint: true, silent: true });
    });
    void registerAlertWorker();
    syncAlertPolling();
  }

  function avatarUrl(emp) {
    const url = String(emp?.avatar_url || "").trim();
    return url || DEFAULT_AVATAR;
  }

  function setAvatarPreview(url) {
    if (els.empAvatarPreview) els.empAvatarPreview.src = url || DEFAULT_AVATAR;
  }

  function clearPendingAvatar() {
    pendingAvatarFile = null;
    pendingAvatarReset = false;
    if (els.empAvatarFile) els.empAvatarFile.value = "";
  }

  async function uploadEmployeeAvatar(employeeId, file) {
    const sb = window.SiteSupabase.getClient();
    if (!sb) throw new Error("Supabase is not configured.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${employeeId}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });
    if (error) throw error;
    const { data } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function applyPendingAvatar(employee) {
    if (!employee?.id) return employee;
    const sb = window.SiteSupabase.getClient();
    if (!sb) return employee;

    if (pendingAvatarReset) {
      const { data, error } = await sb
        .from("employees")
        .update({ avatar_url: null })
        .eq("id", employee.id)
        .select("*")
        .single();
      clearPendingAvatar();
      if (error) throw error;
      return data;
    }

    if (pendingAvatarFile) {
      const publicUrl = await uploadEmployeeAvatar(employee.id, pendingAvatarFile);
      const { data, error } = await sb
        .from("employees")
        .update({ avatar_url: publicUrl })
        .eq("id", employee.id)
        .select("*")
        .single();
      clearPendingAvatar();
      if (error) throw error;
      return data;
    }

    return employee;
  }

  function money(n) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);
  }

  function setBanner(msg, kind) {
    const el = document.getElementById("admin-status");
    if (!el) return;
    statusIsAlert = false;
    el.classList.remove("is-action");
    const text = String(msg || "").trim();
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      el.removeAttribute("data-kind");
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.setAttribute("data-kind", kind === "err" ? "err" : kind === "ok" ? "ok" : "info");
  }

  function setFieldError(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  /** Format US numbers as (401) 300-0957 while typing. */
  function formatPhoneDisplay(value) {
    let digits = digitsOnly(value);
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    if (!digits) return "";
    if (digits.length < 4) return `(${digits}`;
    if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function applyPhoneInputFormat(input) {
    if (!input) return;
    const formatted = formatPhoneDisplay(input.value);
    if (input.value === formatted) return;
    const wasEnd = input.selectionStart === input.value.length;
    input.value = formatted;
    if (wasEnd) {
      try {
        input.setSelectionRange(formatted.length, formatted.length);
      } catch {
        /* ignore */
      }
    }
  }

  function employeeShareUrl(code) {
    const ref = String(code || "").trim();
    const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
    // Direct donate URL with ref — no intermediate /r/ redirect (looks cleaner when scanned).
    if (typeof window.SITE_CONFIG?.checkoutUrl === "function") {
      return window.SITE_CONFIG.checkoutUrl(ref);
    }
    if (origin && ref) return `${origin}/donate?ref=${encodeURIComponent(ref)}`;
    if (ref) return new URL(`/donate?ref=${encodeURIComponent(ref)}`, window.location.origin).href;
    return origin ? `${origin}/donate` : new URL("/donate", window.location.origin).href;
  }

  function paymentLabel(type) {
    const map = {
      cashapp: "Cash App",
      venmo: "Venmo",
      paypal: "PayPal",
      zelle: "Zelle",
      apple_cash: "Apple Cash",
      apple_pay: "Apple Pay",
      google_pay: "Google Pay",
      chime: "Chime",
      cash: "Cash",
      check: "Check",
      bank_transfer: "Bank transfer",
      wire: "Wire",
      wise: "Wise",
      revolut: "Revolut",
      stripe: "Stripe",
      square: "Square",
      bitcoin: "Bitcoin",
      ethereum: "Ethereum",
      usdc: "USDC",
      paypal_friends: "PayPal Friends",
      cashapp_business: "Cash App Business",
      other: "Other",
    };
    return map[type] || type || "—";
  }

  function paymentHandleMeta(type) {
    const map = {
      cashapp: { label: "Cashtag", placeholder: "$cashtag", inputType: "text", autocomplete: "username" },
      cashapp_business: { label: "Business cashtag", placeholder: "$businesscashtag", inputType: "text", autocomplete: "username" },
      venmo: { label: "Venmo username", placeholder: "@username", inputType: "text", autocomplete: "username" },
      paypal: { label: "PayPal email or @username", placeholder: "name@email.com or @username", inputType: "text", autocomplete: "email" },
      paypal_friends: { label: "PayPal email or @username", placeholder: "name@email.com or @username", inputType: "text", autocomplete: "email" },
      zelle: { label: "Zelle phone or email", placeholder: "(555) 123-4567 or name@email.com", inputType: "text", autocomplete: "email" },
      apple_cash: { label: "Phone number", placeholder: "(555) 123-4567", inputType: "tel", autocomplete: "tel" },
      apple_pay: { label: "Phone number", placeholder: "(555) 123-4567", inputType: "tel", autocomplete: "tel" },
      google_pay: { label: "Phone number or email", placeholder: "(555) 123-4567 or name@email.com", inputType: "text", autocomplete: "email" },
      chime: { label: "Chime $Tag or phone", placeholder: "$Tag or (555) 123-4567", inputType: "text", autocomplete: "username" },
      cash: { label: "Payout note", placeholder: "In person / front desk", inputType: "text", autocomplete: "off" },
      check: { label: "Payee name", placeholder: "Name on the check", inputType: "text", autocomplete: "name" },
      bank_transfer: { label: "Account or routing details", placeholder: "Bank + last 4 / account tip", inputType: "text", autocomplete: "off" },
      wire: { label: "Wire instructions", placeholder: "Bank + account reference", inputType: "text", autocomplete: "off" },
      wise: { label: "Wise email or @username", placeholder: "name@email.com or @username", inputType: "text", autocomplete: "email" },
      revolut: { label: "Revolut @Revtag or phone", placeholder: "@revtag or phone", inputType: "text", autocomplete: "username" },
      stripe: { label: "Stripe email or account", placeholder: "name@email.com", inputType: "email", autocomplete: "email" },
      square: { label: "Square Cash App tag or email", placeholder: "$cashtag or email", inputType: "text", autocomplete: "email" },
      bitcoin: { label: "Bitcoin address", placeholder: "bc1… or wallet address", inputType: "text", autocomplete: "off" },
      ethereum: { label: "Ethereum address", placeholder: "0x…", inputType: "text", autocomplete: "off" },
      usdc: { label: "USDC wallet address", placeholder: "Wallet address", inputType: "text", autocomplete: "off" },
      other: { label: "Payout details", placeholder: "How to send payment", inputType: "text", autocomplete: "off" },
    };
    return (
      map[type] || {
        label: "Payout handle",
        placeholder: "Choose a payment type first",
        inputType: "text",
        autocomplete: "off",
      }
    );
  }

  function syncPaymentHandleField(type) {
    const meta = paymentHandleMeta(String(type || "").trim());
    if (els.empPaymentHandleLabel) els.empPaymentHandleLabel.textContent = meta.label;
    if (!els.empPaymentHandle) return;
    els.empPaymentHandle.placeholder = meta.placeholder;
    els.empPaymentHandle.type = meta.inputType || "text";
    els.empPaymentHandle.autocomplete = meta.autocomplete || "off";
    els.empPaymentHandle.setAttribute("aria-label", meta.label);
  }

  function normalizeHandle(raw) {
    return String(raw || "")
      .trim()
      .replace(/^https?:\/\/(www\.)?/i, "")
      .replace(/^(cash\.app\/|paypal\.me\/|venmo\.com\/u\/|venmo\.com\/)/i, "")
      .replace(/^[@$]/, "")
      .replace(/\/+$/, "")
      .trim();
  }

  function payoutTarget(emp) {
    const type = String(emp?.payment_type || "");
    const handle = normalizeHandle(emp?.payment_handle);
    const phone = String(emp?.phone || "").trim();
    const digits = phone.replace(/\D/g, "");

    if (type === "cashapp") {
      if (handle) return { url: `https://cash.app/$${encodeURIComponent(handle)}`, label: "Cash App", copy: null };
      return { url: "https://cash.app/", label: "Cash App", copy: phone || null };
    }
    if (type === "venmo") {
      if (handle) return { url: `https://venmo.com/u/${encodeURIComponent(handle)}`, label: "Venmo", copy: null };
      return { url: "https://venmo.com/", label: "Venmo", copy: phone || null };
    }
    if (type === "paypal") {
      if (handle) return { url: `https://paypal.me/${encodeURIComponent(handle)}`, label: "PayPal", copy: null };
      return { url: "https://www.paypal.com/myaccount/transfer/homepage", label: "PayPal", copy: phone || null };
    }
    if (type === "zelle") {
      return {
        url: "https://www.zellepay.com/",
        label: "Zelle",
        copy: handle || phone || (digits ? digits : null),
      };
    }
    return { url: null, label: paymentLabel(type), copy: handle || phone || null };
  }

  function paidFor(employeeId) {
    return Number(latestPaidByEmployee[employeeId] || 0);
  }

  function grossOwedFor(raised) {
    return Math.max(0, Number(raised || 0) * COMMISSION());
  }

  function netOwedFor(employeeId, raised) {
    return Math.max(0, grossOwedFor(raised) - paidFor(employeeId));
  }

  function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  async function openPayoutApp(emp) {
    const target = payoutTarget(emp);
    const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "volunteer";
    if (target.copy) {
      try {
        await navigator.clipboard.writeText(String(target.copy));
      } catch {
        /* ignore */
      }
    }
    if (target.url) {
      window.open(target.url, "_blank", "noopener,noreferrer");
      setBanner(
        target.copy
          ? `Opened ${target.label} for ${name}. Copied ${target.copy}.`
          : `Opened ${target.label} for ${name}.`,
        "ok"
      );
      return true;
    }
    if (target.copy) {
      setBanner(`Copied payout info for ${name} (${target.label}).`, "ok");
      return true;
    }
    setBanner(`Add a payout handle for ${name} in Edit details.`, "err");
    return false;
  }

  function openPayoutDialog(emp) {
    if (!els.payoutDialog || !emp) return;
    payoutEmployee = emp;
    const stats = latestDonationStats[emp.id] || { count: 0, raised: 0 };
    const paid = paidFor(emp.id);
    const owed = netOwedFor(emp.id, stats.raised);
    const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "volunteer";
    if (els.payEmployeeId) els.payEmployeeId.value = emp.id;
    if (els.payoutTitle) els.payoutTitle.textContent = `Mark ${name} as paid`;
    if (els.payoutLead) {
      els.payoutLead.textContent = "Enter how much you paid so their owed balance updates.";
    }
    if (els.payoutSummary) {
      els.payoutSummary.innerHTML = `
        <div><span>Commission earned</span><strong>${money(grossOwedFor(stats.raised))}</strong></div>
        <div><span>Already paid</span><strong>${money(paid)}</strong></div>
        <div><span>Still owed</span><strong>${money(owed)}</strong></div>
      `;
    }
    if (els.payAmount) els.payAmount.value = owed > 0 ? String(roundMoney(owed)) : "";
    if (els.payNote) els.payNote.value = "";
    if (els.errPayAmount) {
      els.errPayAmount.hidden = true;
      els.errPayAmount.textContent = "";
    }
    openAdminDialog(els.payoutDialog);
    if (window.matchMedia && window.matchMedia("(min-width: 700px)").matches) {
      els.payAmount?.focus();
      els.payAmount?.select?.();
    }
  }

  async function recordPayout(event) {
    event?.preventDefault?.();
    const emp = payoutEmployee || latestEmployees.find((e) => e.id === els.payEmployeeId?.value);
    if (!emp) return;
    const amount = roundMoney(els.payAmount?.value);
    if (!(amount > 0)) {
      if (els.errPayAmount) {
        els.errPayAmount.hidden = false;
        els.errPayAmount.textContent = "Enter at least $0.01.";
      }
      return;
    }
    const note = String(els.payNote?.value || "").trim();
    const sb = window.SiteSupabase?.getClient?.();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    if (els.payoutSubmit) els.payoutSubmit.disabled = true;
    try {
      const { data, error } = await sb.rpc("record_employee_payout", {
        p_employee_id: emp.id,
        p_amount: amount,
        p_note: note || null,
      });
      if (error) throw error;
      if (!data) throw new Error("Payout was not recorded.");
      await closeAdminDialog(els.payoutDialog);
      setBanner(`Recorded ${money(amount)} paid to ${emp.first_name}.`, "ok");
      await loadDashboard({ skipCachePaint: true });
      const refreshed = latestEmployees.find((e) => e.id === emp.id);
      if (refreshed && els.detailDialog?.open) fillEmployeeDetail(refreshed);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not record payout.", "err");
    } finally {
      if (els.payoutSubmit) els.payoutSubmit.disabled = false;
    }
  }

  function isMobileSheetViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  }

  let sheetViewportFrozen = false;

  function syncSheetViewport() {
    if (sheetViewportFrozen) return;
    if (adminDialogs().some((dialog) => dialog.open)) return;
    try {
      const h = Math.round(window.innerHeight || 0);
      if (h > 0) document.documentElement.style.setProperty("--pf-sheet-vh", `${h}px`);
    } catch {
      /* ignore */
    }
  }

  const SHEET_RISE = "transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)";
  const SHEET_FALL = "transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)";

  function sheetHeight(panel) {
    if (!panel) return 1;
    return Math.max(1, Math.ceil(panel.getBoundingClientRect().height || panel.offsetHeight || 0));
  }

  function holdSheet(panel, y) {
    const px = Math.max(0, Math.round(y));
    panel.style.transition = "none";
    panel.style.transform = `translate3d(0, ${px}px, 0)`;
    panel.style.setProperty("--pf-sheet-slide", `${Math.max(px, 1)}px`);
    return px;
  }

  function lockSheetSlide(panel) {
    return holdSheet(panel, sheetHeight(panel));
  }

  function dialogPanel(dialog) {
    return dialog?.querySelector?.(".site-leave-dialog-panel") || null;
  }

  function adminDialogs() {
    return Array.from(document.querySelectorAll("dialog.pf-dialog, dialog.site-leave-dialog"));
  }

  function clearPanelMotion(panel) {
    if (!panel) return;
    panel.style.transform = "";
    panel.style.transition = "";
    panel.style.willChange = "";
    panel.style.visibility = "";
  }

  function clearPanelSizing(panel) {
    if (!panel) return;
    panel.style.maxHeight = "";
    panel.style.height = "";
  }

  function forceCloseDialog(dialog) {
    if (!dialog) return;
    const panel = dialogPanel(dialog);
    dialog.classList.remove("is-sheet", "is-open", "is-entering", "is-closing", "is-dragging", "is-settled");
    clearPanelMotion(panel);
    clearPanelSizing(panel);
    if (dialog.open) dialog.close();
  }

  async function closeOtherAdminDialogs(keep) {
    const openOnes = adminDialogs().filter((d) => d !== keep && d.open);
    await Promise.all(openOnes.map((d) => closeAdminDialog(d, { immediate: true })));
  }

  function prepareSheetPanel(dialog, panel) {
    if (!panel || !isMobileSheetViewport()) return;
    syncSheetViewport();
    // CSS owns sizing — forced px heights made the sheet jump and clipped buttons.
    panel.style.maxHeight = "";
    panel.style.height = "";
    panel.scrollTop = 0;
    const scroller = panel.querySelector("[data-sheet-scroll]");
    if (scroller) scroller.scrollTop = 0;
  }

  async function openAdminDialog(dialog) {
    if (!dialog) return;
    await closeOtherAdminDialogs(dialog);
    dialog.classList.remove("is-closing", "is-dragging", "is-open", "is-entering", "is-settled");
    const panel = dialogPanel(dialog);
    clearPanelMotion(panel);
    sheetViewportFrozen = false;
    syncSheetViewport();
    prepareSheetPanel(dialog, panel);

    const mobile = isMobileSheetViewport();
    const animate = mobile && panel && !prefersReducedMotion();

    if (mobile) sheetViewportFrozen = true;

    if (mobile) {
      dialog.classList.add("is-sheet", "is-entering");
      if (animate && panel) {
        panel.style.visibility = "hidden";
        panel.style.willChange = "transform";
        panel.style.transition = "none";
      }
    }

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
    try {
      dialog.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
    const scroller = panel?.querySelector?.("[data-sheet-scroll]");
    if (scroller) scroller.scrollTop = 0;

    if (!mobile) {
      sheetViewportFrozen = false;
      dialog.classList.add("is-open", "is-settled");
      return;
    }
    if (!animate) {
      sheetViewportFrozen = false;
      dialog.classList.remove("is-entering");
      dialog.classList.add("is-open", "is-settled");
      clearPanelMotion(panel);
      return;
    }

    const slide = sheetHeight(panel);
    panel.style.height = `${slide}px`;
    holdSheet(panel, slide);
    panel.style.visibility = "visible";
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!dialog.open || dialog.classList.contains("is-closing")) {
          sheetViewportFrozen = false;
          return;
        }
        dialog.classList.remove("is-entering");
        dialog.classList.add("is-open");
        panel.style.transition = SHEET_RISE;
        panel.style.transform = "translate3d(0, 0, 0)";
        let settled = false;
        const settle = (e) => {
          if (settled) return;
          if (e && (e.target !== panel || e.propertyName !== "transform")) return;
          settled = true;
          panel.removeEventListener("transitionend", settle);
          if (!dialog.open || dialog.classList.contains("is-closing")) {
            sheetViewportFrozen = false;
            return;
          }
          dialog.classList.add("is-settled");
          sheetViewportFrozen = false;
        };
        panel.addEventListener("transitionend", settle);
        window.setTimeout(() => settle(), 560);
      });
    });
  }

  function closeAdminDialog(dialog, opts = {}) {
    if (!dialog?.open) {
      forceCloseDialog(dialog);
      return Promise.resolve();
    }
    if (opts.immediate || !isMobileSheetViewport() || prefersReducedMotion()) {
      sheetViewportFrozen = false;
      forceCloseDialog(dialog);
      return Promise.resolve();
    }
    if (dialog.classList.contains("is-closing")) {
      return new Promise((resolve) => {
        dialog.addEventListener("close", () => resolve(), { once: true });
      });
    }
    return new Promise((resolve) => {
      const panel = dialogPanel(dialog);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        sheetViewportFrozen = false;
        forceCloseDialog(dialog);
        resolve();
      };
      sheetViewportFrozen = true;
      const slide = panel ? sheetHeight(panel) : 0;
      if (panel) {
        panel.style.height = `${slide}px`;
        panel.style.willChange = "transform";
        holdSheet(panel, 0);
        void panel.offsetHeight;
      }
      dialog.classList.remove("is-settled", "is-entering", "is-open");
      dialog.classList.add("is-closing");
      if (panel) {
        panel.style.transition = SHEET_FALL;
        panel.style.transform = `translate3d(0, ${slide}px, 0)`;
      }
      const onEnd = (e) => {
        if (e.target !== panel || e.propertyName !== "transform") return;
        panel.removeEventListener("transitionend", onEnd);
        finish();
      };
      panel?.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 480);
    });
  }

  function enableDialogBackdropClose(dialog) {
    if (!dialog || dialog.dataset.backdropClose === "1") return;
    dialog.dataset.backdropClose = "1";
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) closeAdminDialog(dialog);
    });
  }

  function ensureSheetHandle(panel) {
    if (!panel) return null;
    let handle = panel.querySelector(":scope > .pf-sheet-handle");
    if (handle) return handle;
    handle = document.createElement("button");
    handle.type = "button";
    handle.className = "pf-sheet-handle";
    handle.setAttribute("aria-label", "Drag down to close");
    handle.tabIndex = -1;
    panel.insertBefore(handle, panel.firstChild);
    return handle;
  }

  function enableDialogSheetDrag(dialog) {
    if (!dialog || dialog.dataset.sheetDrag === "1") return;
    dialog.dataset.sheetDrag = "1";
    const panel = dialogPanel(dialog);
    if (!panel) return;
    const handle = ensureSheetHandle(panel);

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let dragging = false;
    let moved = false;
    let velocity = 0;
    let activePointer = null;

    const DISMISS_PX = 96;
    const DISMISS_V = 0.7;

    function resetDragStyles() {
      panel.style.transition = "";
      panel.style.transform = "";
      panel.style.willChange = "";
    }

    function beginDrag(pointerId, clientY) {
      dragging = true;
      moved = false;
      startY = clientY;
      lastY = clientY;
      lastT = performance.now();
      velocity = 0;
      activePointer = pointerId;
      dialog.classList.add("is-dragging");
      panel.style.transition = "none";
      panel.style.willChange = "transform";
      try {
        handle.setPointerCapture?.(pointerId);
      } catch {
        /* ignore */
      }
    }

    function endDrag(commitClose) {
      if (!dragging) return;
      dragging = false;
      activePointer = null;
      dialog.classList.remove("is-dragging");
      if (commitClose) {
        closeAdminDialog(dialog);
        return;
      }
      dialog.classList.remove("is-settled");
      panel.style.transition = SHEET_RISE;
      panel.style.transform = "translate3d(0, 0, 0)";
      const clear = () => {
        resetDragStyles();
        dialog.classList.add("is-settled");
        panel.removeEventListener("transitionend", clear);
      };
      panel.addEventListener("transitionend", clear);
      window.setTimeout(clear, 520);
    }

    // Handle-only drag. Body gestures must stay free so the sheet can scroll.
    function onHandlePointerDown(e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!isMobileSheetViewport() || !dialog.open || dialog.classList.contains("is-closing")) return;
      if (dragging) return;
      beginDrag(e.pointerId, e.clientY);
      if (e.cancelable) e.preventDefault();
      e.stopPropagation?.();
    }

    function onHandlePointerMove(e) {
      if (!dragging || (activePointer != null && e.pointerId !== activePointer)) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      velocity = (e.clientY - lastY) / dt;
      lastY = e.clientY;
      lastT = now;
      const pull = Math.max(0, e.clientY - startY);
      if (pull > 4) moved = true;
      panel.style.transform = `translate3d(0, ${pull}px, 0)`;
      if (e.cancelable) e.preventDefault();
    }

    function onHandlePointerUp(e) {
      if (!dragging || (activePointer != null && e.pointerId !== activePointer)) return;
      const dy = Math.max(0, lastY - startY);
      const shouldClose = moved && (dy >= DISMISS_PX || velocity >= DISMISS_V);
      endDrag(shouldClose);
    }

    handle.addEventListener("pointerdown", onHandlePointerDown, { passive: false });
    handle.addEventListener("pointermove", onHandlePointerMove, { passive: false });
    handle.addEventListener("pointerup", onHandlePointerUp);
    handle.addEventListener("pointercancel", onHandlePointerUp);
  }

  function wireDialogBackdropClose() {
    document.querySelectorAll("dialog.pf-dialog, dialog.site-leave-dialog").forEach((dialog) => {
      enableDialogBackdropClose(dialog);
      enableDialogSheetDrag(dialog);
    });
    syncSheetViewport();
    if (!window.__pfSheetViewportBound) {
      window.__pfSheetViewportBound = true;
      const onViewport = () => syncSheetViewport();
      window.addEventListener("resize", onViewport, { passive: true });
      window.visualViewport?.addEventListener("resize", onViewport, { passive: true });
      window.visualViewport?.addEventListener("scroll", onViewport, { passive: true });
    }
  }

  function referralCode() {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    return Math.random().toString(36).slice(2, 12);
  }

  function relativeTime(iso) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function absoluteTime(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const REGION_ABBR = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY",
    "district of columbia": "DC",
  };

  function shortRegion(region) {
    const value = String(region || "").trim();
    if (!value) return "";
    if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
    return REGION_ABBR[value.toLowerCase()] || value;
  }

  function formatPlace(parts) {
    const city = String(parts?.city || "").trim();
    const region = shortRegion(parts?.region);
    if (city && region) return `${city}, ${region}`;
    if (city) return city;
    if (region) return region;
    const country = String(parts?.country || "").trim();
    if (/^(united states|united states of america|usa|us)$/i.test(country)) return "";
    return country;
  }

  function buildLocationIndex(visits) {
    const byCode = new Map();
    const byEmployee = new Map();
    visits.forEach((v) => {
      const place = formatPlace(v);
      if (!place) return;
      const code = String(v.referral_code || "").trim();
      if (code) {
        const list = byCode.get(code) || [];
        list.push(place);
        byCode.set(code, list);
      }
      if (v.employee_id) {
        const list = byEmployee.get(v.employee_id) || [];
        list.push(place);
        byEmployee.set(v.employee_id, list);
      }
    });
    function pick(map, key) {
      const list = map.get(key);
      if (!list?.length) return "";
      const counts = new Map();
      list.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }
    return {
      forDonation(d) {
        if (d.referral_code && pick(byCode, String(d.referral_code).trim())) {
          return pick(byCode, String(d.referral_code).trim());
        }
        if (d.employee_id && pick(byEmployee, d.employee_id)) {
          return pick(byEmployee, d.employee_id);
        }
        return "";
      },
    };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function setLoading(isLoading) {
    if (els.skeleton && !document.documentElement.classList.contains("pf-admin-booting")) {
      els.skeleton.hidden = !isLoading;
    }
    if (els.content) els.content.classList.toggle("is-loading", isLoading);
  }

  function finishAdminBoot() {
    document.documentElement.classList.remove("pf-admin-booting");
    if (els.skeleton) els.skeleton.hidden = true;
    if (els.content) els.content.classList.remove("is-loading");
    requestAnimationFrame(() => moveDockIndicator(false));
  }

  async function openQrDialog(employee) {
    const url = employeeShareUrl(employee.referral_code);
    currentQr = {
      url,
      name: `${employee.first_name}-${employee.last_name}`.replace(/\s+/g, "-"),
    };
    els.qrLead.textContent = `QR for ${employee.first_name} ${employee.last_name}. Opens the donate page (any amount on Stripe) and attributes the gift to code ${employee.referral_code}.`;
    els.qrLinkText.textContent = url;
    els.qrHost.innerHTML = "";
    openAdminDialog(els.qrDialog);
    try {
      await window.PfQr.renderInto(els.qrHost, url, 220);
    } catch (err) {
      console.error(err);
      els.qrHost.textContent = "Could not render QR.";
      setBanner("Could not render QR. Try Download after refreshing.", "err");
    }
  }

  function buildVisitStats(visits, employees) {
    const byId = Object.create(null);
    const codeToId = Object.create(null);
    employees.forEach((emp) => {
      byId[emp.id] = { count: 0, places: Object.create(null) };
      if (emp.referral_code) codeToId[String(emp.referral_code).trim()] = emp.id;
    });
    visits.forEach((v) => {
      let id = v.employee_id || null;
      if (!id && v.referral_code) id = codeToId[String(v.referral_code).trim()] || null;
      if (!id || !byId[id]) return;
      byId[id].count += 1;
      const place = formatPlace(v) || "Unknown";
      byId[id].places[place] = (byId[id].places[place] || 0) + 1;
    });
    return byId;
  }

  function openVisitsDialog(emp, visitInfo) {
    if (!els.visitsDialog) return;
    const name = `${emp.first_name} ${emp.last_name}`.trim();
    if (els.visitsTitle) els.visitsTitle.textContent = `Visits · ${name}`;
    if (els.visitsLead) {
      els.visitsLead.textContent = visitInfo.count
        ? `${visitInfo.count} visit${visitInfo.count === 1 ? "" : "s"} with location detail.`
        : "No visits recorded for this volunteer yet.";
    }
    const list = els.visitsList;
    if (list) list.innerHTML = "";
    const ranked = Object.entries(visitInfo.places || {}).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) {
      if (els.visitsEmpty) els.visitsEmpty.hidden = false;
    } else {
      if (els.visitsEmpty) els.visitsEmpty.hidden = true;
      ranked.forEach(([place, count]) => {
        const li = document.createElement("li");
        li.className = "pf-visits-row";
        li.innerHTML = `<span>${escapeHtml(place)}</span><strong>${count}</strong>`;
        list.appendChild(li);
      });
    }
    openAdminDialog(els.visitsDialog);
  }

  function fillEmployeeDetail(emp) {
    detailEmployee = emp;
    const stats = latestDonationStats[emp.id] || { count: 0, raised: 0 };
    const visits = latestVisitStats[emp.id] || { count: 0, places: {} };
    const paid = paidFor(emp.id);
    const owed = netOwedFor(emp.id, stats.raised);
    const phone = formatPhoneDisplay(emp.phone || "");

    if (els.detailAvatar) {
      els.detailAvatar.src = avatarUrl(emp);
      els.detailAvatar.onerror = () => {
        els.detailAvatar.src = DEFAULT_AVATAR;
      };
    }
    if (els.detailTitle) els.detailTitle.textContent = personLabel(emp);
    if (els.detailPhone) els.detailPhone.textContent = phone || "No phone on file";
    if (els.detailVisits) els.detailVisits.textContent = String(visits.count || 0);
    if (els.detailRaised) els.detailRaised.textContent = money(stats.raised);
    if (els.detailOwed) els.detailOwed.textContent = money(owed);
    if (els.detailPaid) els.detailPaid.textContent = money(paid);
  }

  function openEmployeeDetail(emp) {
    if (!els.detailDialog) return;
    fillEmployeeDetail(emp);
    openAdminDialog(els.detailDialog);
  }

  function closeEmployeeDetail() {
    detailEmployee = null;
    closeAdminDialog(els.detailDialog);
  }

  async function changeEmployeePhoto(emp, file) {
    if (!emp?.id || !file) return;
    if (file.size > 2 * 1024 * 1024) {
      setBanner("Photo must be 2MB or smaller.", "err");
      return;
    }
    try {
      setBanner(`Updating photo for ${emp.first_name}…`);
      const publicUrl = await uploadEmployeeAvatar(emp.id, file);
      const sb = window.SiteSupabase.getClient();
      const { error } = await sb.from("employees").update({ avatar_url: publicUrl }).eq("id", emp.id);
      if (error) throw error;
      setBanner(`Photo updated for ${emp.first_name}.`, "ok");
      await loadDashboard({ skipCachePaint: true });
      const refreshed = latestEmployees.find((e) => e.id === emp.id);
      if (refreshed && els.detailDialog?.open) fillEmployeeDetail(refreshed);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not update photo.", "err");
    }
  }

  async function resetEmployeePhoto(emp) {
    if (!emp?.id) return;
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    try {
      setBanner(`Resetting photo for ${emp.first_name}…`);
      const { error } = await sb.from("employees").update({ avatar_url: null }).eq("id", emp.id);
      if (error) throw error;
      if (els.detailAvatar) els.detailAvatar.src = DEFAULT_AVATAR;
      setBanner(`Photo reset for ${emp.first_name}.`, "ok");
      await loadDashboard({ skipCachePaint: true });
      const refreshed = latestEmployees.find((e) => e.id === emp.id);
      if (refreshed && els.detailDialog?.open) fillEmployeeDetail(refreshed);
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not reset photo.", "err");
    }
  }

  function renderEmployees(employees, donationStats, visitStats) {
    latestEmployees = employees;
    latestVisitStats = visitStats || {};
    latestDonationStats = donationStats || {};
    const body = els.employeesBody;
    if (!body) return;
    body.innerHTML = "";
    if (!employees.length) {
      if (els.employeesEmpty) els.employeesEmpty.hidden = false;
      return;
    }
    if (els.employeesEmpty) els.employeesEmpty.hidden = true;

    employees.forEach((emp) => {
      const stats = donationStats[emp.id] || { count: 0, raised: 0 };
      const visits = visitStats[emp.id] || { count: 0, places: {} };
      const owed = netOwedFor(emp.id, stats.raised);
      const paid = paidFor(emp.id);
      const createdAbs = absoluteTime(emp.created_at);
      const createdRel = relativeTime(emp.created_at);
      const createdLabel = createdAbs || createdRel;
      const li = document.createElement("li");
      li.className = "pf-employee-row";
      li.dataset.employeeId = emp.id;
      li.innerHTML = `
        <div class="pf-employee-identity">
          <img class="pf-avatar" src="${escapeHtml(avatarUrl(emp))}" alt="" width="32" height="32" loading="lazy" onerror="this.src='doc/default-avatar.jpg'">
          <div class="pf-employee-main">
            <div class="pf-employee-name-row">
              <strong>${escapeHtml(personLabel(emp))}</strong>
              ${createdLabel ? `<span class="pf-employee-joined" title="Created ${escapeHtml(createdAbs || createdRel)}${createdRel && createdAbs ? ` · ${escapeHtml(createdRel)}` : ""}">${escapeHtml(createdLabel)}</span>` : ""}
            </div>
            <div class="pf-employee-stats" aria-label="Volunteer snapshot">
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Visits</span><span class="pf-stat-chip-value">${visits.count}</span></span>
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Raised</span><span class="pf-stat-chip-value">${money(stats.raised)}</span></span>
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Owed</span><span class="pf-stat-chip-value">${money(owed)}</span></span>
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Paid</span><span class="pf-stat-chip-value">${money(paid)}</span></span>
          </div>
          </div>
        </div>
        <div class="pf-employee-actions">
          <button type="button" class="btn secondary btn-sm" data-action="more">View more</button>
        </div>
      `;
      li.querySelector('[data-action="more"]').addEventListener("click", () => openEmployeeDetail(emp));
      body.appendChild(li);
    });
  }

  function renderDonations(rows, employeeMap, locationIndex) {
    const feed = els.donationsFeed;
    if (!feed) return;
    feed.innerHTML = "";
    const total = rows.length;
    if (els.inboxCountHint) {
      els.inboxCountHint.textContent = total ? `${total} gift${total === 1 ? "" : "s"}` : "Empty";
    }
    if (!rows.length) {
      if (els.donationsEmpty) els.donationsEmpty.hidden = false;
      return;
    }
    if (els.donationsEmpty) els.donationsEmpty.hidden = true;
    rows.slice(0, 40).forEach((d) => {
      const emp = d.employee_id ? employeeMap[d.employee_id] : null;
      const employeeName = emp
        ? `${emp.first_name || ""} ${emp.last_name || ""}`.trim()
        : "";
      const donor = d.donor_label || "Anonymous";
      const place = String(locationIndex?.forDonation(d) || "").trim();
      const viaQr = !!(emp || d.referral_code);
      const channel = viaQr ? "Volunteer QR" : "Direct";
      const whenAbs = absoluteTime(d.created_at);
      const whenRel = relativeTime(d.created_at);
      const li = document.createElement("li");
      li.className = "pf-donation-row";
      li.dataset.donationId = d.id;
      li.innerHTML = `
        <div class="pf-donation-main">
          <div class="pf-donation-top">
            <div class="pf-donation-identity">
              <strong class="pf-donation-donor">${escapeHtml(donor)}</strong>
              <p class="pf-donation-when">${escapeHtml(whenAbs)}${whenRel ? ` · ${escapeHtml(whenRel)}` : ""}</p>
              <p class="pf-donation-employee">Volunteer: ${escapeHtml(employeeName || "None")}</p>
        </div>
        <span class="feed-amount">${money(d.amount)}</span>
          </div>
          <button type="button" class="pf-don-more" data-don-action="more" aria-expanded="false">View more</button>
        </div>
        <div class="pf-donation-more" hidden>
          <dl class="pf-donation-details">
            <div><dt>Via</dt><dd>${escapeHtml(channel)}</dd></div>
            <div><dt>Where</dt><dd>${escapeHtml(place || "Location unknown")}</dd></div>
            ${
              d.referral_code
                ? `<div><dt>Code</dt><dd><code>${escapeHtml(d.referral_code)}</code></dd></div>`
                : ""
            }
          </dl>
          <div class="pf-donation-actions">
            <button type="button" class="pf-chip-btn" data-don-action="edit">Edit</button>
            <button type="button" class="pf-chip-btn pf-chip-btn--danger" data-don-action="delete">Delete</button>
          </div>
        </div>
      `;
      const moreBtn = li.querySelector('[data-don-action="more"]');
      const morePanel = li.querySelector(".pf-donation-more");
      moreBtn?.addEventListener("click", () => {
        const open = morePanel?.hidden === false;
        if (morePanel) morePanel.hidden = open;
        li.classList.toggle("is-expanded", !open);
        if (moreBtn) {
          moreBtn.setAttribute("aria-expanded", open ? "false" : "true");
          moreBtn.textContent = open ? "View more" : "View less";
        }
      });
      li.querySelector('[data-don-action="edit"]')?.addEventListener("click", () => openEditDonation(d));
      li.querySelector('[data-don-action="delete"]')?.addEventListener("click", () => deleteDonation(d));
      feed.appendChild(li);
    });
  }

  function fillDonationEmployeeOptions(selectedId) {
    if (!els.donEmployee) return;
    const current = selectedId || "";
    els.donEmployee.innerHTML = `<option value="">General (no volunteer)</option>`;
    latestEmployees.forEach((emp) => {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = `${emp.first_name} ${emp.last_name}`.trim();
      if (emp.id === current) opt.selected = true;
      els.donEmployee.appendChild(opt);
    });
  }

  function openEditDonation(donation) {
    if (!els.donationDialog || !donation) return;
    editingDonationId = donation.id;
    if (els.donationTitle) els.donationTitle.textContent = "Edit donation";
    if (els.donationLead) els.donationLead.textContent = "Update amount, donor label, or attribution.";
    if (els.donId) els.donId.value = donation.id;
    if (els.donAmount) els.donAmount.value = Number(donation.amount) || "";
    if (els.donDonor) els.donDonor.value = donation.donor_label || "";
    if (els.errDonAmount) {
      els.errDonAmount.hidden = true;
      els.errDonAmount.textContent = "";
    }
    fillDonationEmployeeOptions(donation.employee_id || "");
    openAdminDialog(els.donationDialog);
    if (window.matchMedia && window.matchMedia("(min-width: 700px)").matches) {
      els.donAmount?.focus();
    }
  }

  async function saveDonation(event) {
    event.preventDefault();
    const id = editingDonationId || els.donId?.value;
    if (!id) return;
    const amount = Number(els.donAmount?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      if (els.errDonAmount) {
        els.errDonAmount.hidden = false;
        els.errDonAmount.textContent = "Enter an amount greater than 0.";
      }
      return;
    }
    const employeeId = String(els.donEmployee?.value || "").trim() || null;
    const emp = employeeId ? latestEmployees.find((e) => e.id === employeeId) : null;
    const donorLabel = String(els.donDonor?.value || "").trim() || null;
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    if (els.donationSubmit) els.donationSubmit.disabled = true;
    setBanner("Saving donation…");
    try {
      const { error } = await sb
        .from("donations")
        .update({
          amount,
          donor_label: donorLabel,
          employee_id: employeeId,
          referral_code: emp?.referral_code || null,
        })
        .eq("id", id);
      if (error) throw error;
      await closeAdminDialog(els.donationDialog);
      editingDonationId = null;
      setBanner("Donation updated.", "ok");
      await loadDashboard({ skipCachePaint: true });
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not update donation.", "err");
    } finally {
      if (els.donationSubmit) els.donationSubmit.disabled = false;
    }
  }

  async function deleteDonation(donation) {
    if (!donation?.id) return;
    const label = donation.donor_label || "Anonymous";
    const ok = await askConfirm({
      title: `Delete ${money(donation.amount)} gift?`,
      lead: `Remove the donation from ${label}. This cannot be undone.`,
      confirmLabel: "Delete donation",
    });
    if (!ok) return;
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    setBanner("Deleting donation…");
    try {
      const { error } = await sb.from("donations").delete().eq("id", donation.id);
      if (error) throw error;
      setBanner("Donation deleted.", "ok");
      await loadDashboard({ skipCachePaint: true });
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not delete donation.", "err");
    }
  }

  function topPlaces(visits, limit = 5) {
    const counts = new Map();
    visits.forEach((v) => {
      const key = formatPlace(v) || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  function openStatInfo(key) {
    if (!els.statInfoDialog) return;
    const rate = Math.round(COMMISSION() * 100);
    const attributedCount = latestDonations.filter((d) => d.employee_id).length;
    const generalCount = latestDonations.length - attributedCount;
    const recent = [...latestDonations]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    const places = topPlaces(latestVisits, 5);

    const configs = {
      donors: {
        title: "Donors",
        lead: "Total gift records currently loaded in Donations.",
        items: [
          `${latestSnapshot.donors} donation${latestSnapshot.donors === 1 ? "" : "s"} total`,
          `${attributedCount} attributed to a volunteer`,
          `${generalCount} general / unattributed`,
          ...recent.map(
            (d) =>
              `${money(d.amount)} · ${d.donor_label || "Anonymous"} · ${relativeTime(d.created_at)}`
          ),
        ],
      },
      donors24h: {
        title: "Last 24 hours",
        lead: "Gifts recorded in the past 24 hours.",
        items: [
          `${latestSnapshot.donors24h} donation${latestSnapshot.donors24h === 1 ? "" : "s"} in the last 24h`,
          `Org total still ${latestSnapshot.donors}`,
          ...recent
            .filter((d) => Date.now() - new Date(d.created_at).getTime() <= 24 * 60 * 60 * 1000)
            .map((d) => `${money(d.amount)} · ${d.donor_label || "Anonymous"}`),
        ],
      },
      raised: {
        title: "Raised",
        lead: "Sum of all donation amounts in the feed.",
        items: [
          `${money(latestSnapshot.raised)} total raised`,
          `${money(latestSnapshot.attributedRaised)} attributed to volunteers`,
          `${money(latestSnapshot.raised - latestSnapshot.attributedRaised)} general / unattributed`,
          `${latestSnapshot.donors} gifts counted`,
        ],
      },
      owed: {
        title: "Owed",
        lead: `Volunteer commission on attributed gifts (${rate}%), minus recorded payouts.`,
        items: [
          `${money(latestSnapshot.owed)} still owed`,
          `${money(latestSnapshot.paid)} already paid out`,
          `Based on ${money(latestSnapshot.attributedRaised)} attributed raised`,
          `Commission rate ${rate}%`,
          "Use Pay on a volunteer to record a payout and reduce owed",
        ],
      },
      visits: {
        title: "Visits",
        lead: "QR / donate page visits with location data when available.",
        items: [
          `${latestSnapshot.visits} visit${latestSnapshot.visits === 1 ? "" : "s"} recorded`,
          ...places.map(([place, count]) => `${place} · ${count}`),
        ],
      },
    };

    const cfg = configs[key] || {
      title: "Dashboard",
      lead: "Organization snapshot.",
      items: [],
    };
    if (els.statInfoTitle) els.statInfoTitle.textContent = cfg.title;
    if (els.statInfoLead) els.statInfoLead.textContent = cfg.lead;
    if (els.statInfoList) {
      els.statInfoList.innerHTML = "";
      cfg.items.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        els.statInfoList.appendChild(li);
      });
    }
    openAdminDialog(els.statInfoDialog);
  }

  function renderGeo(visits) {
    const counts = new Map();
    visits.forEach((v) => {
      const key = formatPlace(v) || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (!els.geoChart) return;
    els.geoChart.innerHTML = "";
    if (!ranked.length) {
      if (els.geoEmpty) els.geoEmpty.hidden = false;
      return;
    }
    if (els.geoEmpty) els.geoEmpty.hidden = true;

    const list = document.createElement("ul");
    list.className = "pf-geo-list";
    ranked.forEach(([label, count]) => {
      const li = document.createElement("li");
      li.className = "pf-geo-row";
      const name = document.createElement("span");
      name.className = "pf-geo-name";
      name.textContent = label;
      const num = document.createElement("span");
      num.className = "pf-geo-num";
      num.textContent = String(count);
      li.append(name, num);
      list.appendChild(li);
    });
    els.geoChart.appendChild(list);
  }

  function applyDashboardData({ employees, donations, payouts, visits, donors24h }) {
    const donationStats = {};
    let raisedTotal = 0;
    donations.forEach((d) => {
      raisedTotal += Number(d.amount) || 0;
      if (!d.employee_id) return;
      if (!donationStats[d.employee_id]) donationStats[d.employee_id] = { count: 0, raised: 0 };
      donationStats[d.employee_id].count += 1;
      donationStats[d.employee_id].raised += Number(d.amount) || 0;
    });

    const paidByEmployee = {};
    let paidTotal = 0;
    (payouts || []).forEach((p) => {
      const amount = Number(p.amount) || 0;
      paidTotal += amount;
      if (!p.employee_id) return;
      paidByEmployee[p.employee_id] = (paidByEmployee[p.employee_id] || 0) + amount;
    });

    const attributedRaised = Object.values(donationStats).reduce((s, x) => s + x.raised, 0);
    const grossOwed = attributedRaised * COMMISSION();
    const owedTotal = Math.max(0, grossOwed - paidTotal);

    latestEmployees = employees;
    latestDonations = donations;
    latestPayouts = payouts || [];
    latestPaidByEmployee = paidByEmployee;
    latestDonationStats = donationStats;
    latestVisits = visits;
    latestSnapshot = {
      donors: donations.length,
      donors24h: donors24h ?? 0,
      raised: raisedTotal,
      attributedRaised,
      paid: paidTotal,
      owed: owedTotal,
      visits: visits.length,
    };

    if (els.totalDonors) els.totalDonors.textContent = String(donations.length);
    if (els.donors24h) els.donors24h.textContent = String(donors24h ?? 0);
    if (els.totalDonated) els.totalDonated.textContent = money(raisedTotal);
    if (els.totalOwed) els.totalOwed.textContent = money(owedTotal);
    if (els.totalVisits) els.totalVisits.textContent = String(visits.length);

    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    const locationIndex = buildLocationIndex(visits);
    const visitStats = buildVisitStats(visits, employees);
    renderEmployees(employees, donationStats, visitStats);
    renderDonations(donations, employeeMap, locationIndex);
    renderGeo(visits);
    announceFreshActivity(employees, visits, donations);
  }

  async function loadDashboard(opts = {}) {
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Add your Supabase URL and anon key in js/config.js (see .env.example).", "err");
      return;
    }

    const cached = readCache();
    if (cached?.employees && !opts.skipCachePaint) {
      applyDashboardData(cached);
      setLoading(false);
    } else if (!opts.silent) {
      setLoading(true);
      setBanner("Loading…");
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let empRes, donRes, payRes, visitRes, don24Res;
    try {
      const timed = Promise.race([
        Promise.all([
          sb.from("employees").select("*").order("created_at", { ascending: false }),
          sb.from("donations").select("*").order("created_at", { ascending: false }).limit(200),
          sb.from("payouts").select("*").order("created_at", { ascending: false }).limit(500),
          sb.from("visits").select("id,city,region,country,created_at,referral_code,employee_id").order("created_at", { ascending: false }).limit(1000),
          sb.from("donations").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timed out loading dashboard data.")), 12000)
        ),
      ]);
      [empRes, donRes, payRes, visitRes, don24Res] = await timed;
    } catch (err) {
      setLoading(false);
      setBanner(err.message || "Failed to load data.", "err");
      console.error(err);
      return;
    }

    if (empRes.error || donRes.error || payRes.error || visitRes.error) {
      setLoading(false);
      const err = empRes.error || donRes.error || payRes.error || visitRes.error;
      setBanner(err.message || "Failed to load data. Sign in again if this persists.", "err");
      console.error(empRes.error, donRes.error, payRes.error, visitRes.error);
      return;
    }

    const payload = {
      employees: empRes.data || [],
      donations: donRes.data || [],
      payouts: payRes.data || [],
      visits: visitRes.data || [],
      donors24h: don24Res.count ?? 0,
    };
    writeCache(payload);
    applyDashboardData(payload);
    setLoading(false);
    if (!opts.silent && !statusIsAlert) setBanner("", null);
    if (!opts.silent) maybeNudgeNotifications();
  }

  function clearEmployeeErrors() {
    setFieldError(els.errFirst, "");
    setFieldError(els.errLast, "");
    setFieldError(els.errPhone, "");
    setFieldError(els.errPayment, "");
    setFieldError(els.errHandle, "");
  }

  function personLabel(emp, fallback = "Volunteer") {
    const first = String(emp?.first_name || "").replace(/\u00A0/g, " ").trim();
    const last = String(emp?.last_name || "").replace(/\u00A0/g, " ").trim();
    return `${first} ${last}`.trim() || fallback;
  }

  function readEmployeeForm() {
    const fd = new FormData(els.employeeForm);
    const handle = normalizeHandle(fd.get("payment_handle"));
    return {
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      phone: formatPhoneDisplay(fd.get("phone")),
      payment_type: String(fd.get("payment_type") || "").trim(),
      payment_handle: handle,
    };
  }

  function validateEmployeeForm(payload) {
    clearEmployeeErrors();
    let bad = false;
    if (payload.first_name && payload.first_name.length > 80) {
      setFieldError(els.errFirst, "First name is too long.");
      bad = true;
    }
    if (payload.last_name && payload.last_name.length > 80) {
      setFieldError(els.errLast, "Last name is too long.");
      bad = true;
    }
    const phoneDigits = digitsOnly(payload.phone);
    if (!phoneDigits) {
      setFieldError(els.errPhone, "Enter a phone number.");
      bad = true;
    } else if (phoneDigits.length < 10) {
      setFieldError(els.errPhone, "Enter a 10-digit phone number.");
      bad = true;
    }
    if (!payload.payment_type) {
      setFieldError(els.errPayment, "Choose a payment type.");
      bad = true;
    }
    if (!payload.payment_handle) {
      const handleLabel = paymentHandleMeta(payload.payment_type).label || "payout details";
      setFieldError(els.errHandle, `Enter ${handleLabel.toLowerCase()}.`);
      bad = true;
    }
    return !bad;
  }

  function setPaymentSelect(value) {
    if (!els.empPayment) return;
    const next = String(value || "").trim();
    if (next) {
      els.empPayment.value = next;
    } else {
      els.empPayment.selectedIndex = 0;
    }
    syncPaymentHandleField(els.empPayment.value);
    els.empPayment.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function openNewEmployee() {
    editingEmployeeId = null;
    clearPendingAvatar();
    els.employeeForm.reset();
    if (els.empId) els.empId.value = "";
    clearEmployeeErrors();
    setAvatarPreview(DEFAULT_AVATAR);
    if (els.employeeTitle) els.employeeTitle.textContent = "New volunteer";
    if (els.employeeLead) els.employeeLead.textContent = "Add a volunteer and generate their Stripe donation QR.";
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Create & generate QR";
    setPaymentSelect("");
    if (els.empPaymentHandle) els.empPaymentHandle.value = "";
    syncPaymentHandleField("");
    openAdminDialog(els.employeeDialog);
    // Avoid iOS input zoom jump: don't autofocus on small screens.
    if (window.matchMedia && window.matchMedia("(min-width: 700px)").matches) {
      els.empFirst?.focus();
    }
  }

  function openEditEmployee(emp) {
    editingEmployeeId = emp.id;
    clearPendingAvatar();
    clearEmployeeErrors();
    if (els.empId) els.empId.value = emp.id;
    if (els.empFirst) els.empFirst.value = emp.first_name || "";
    if (els.empLast) els.empLast.value = emp.last_name || "";
    if (els.empPhone) els.empPhone.value = formatPhoneDisplay(emp.phone || "");
    setPaymentSelect(emp.payment_type || "");
    if (els.empPaymentHandle) els.empPaymentHandle.value = emp.payment_handle || "";
    setAvatarPreview(avatarUrl(emp));
    if (els.employeeTitle) els.employeeTitle.textContent = "Edit volunteer";
    if (els.employeeLead) {
      els.employeeLead.textContent = "Rename, update payout details, or change their photo. QR code stays the same.";
    }
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Save changes";
    openAdminDialog(els.employeeDialog);
    if (window.matchMedia && window.matchMedia("(min-width: 700px)").matches) {
      els.empFirst?.focus();
    }
  }

  async function saveEmployee(e) {
    e.preventDefault();
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }

    const payload = readEmployeeForm();
    if (!validateEmployeeForm(payload)) return;

    const isEdit = !!editingEmployeeId;
    els.employeeSubmit.disabled = true;
    const createLabel = `${payload.first_name || ""} ${payload.last_name || ""}`.trim() || "volunteer";
    setBanner(isEdit ? "Saving…" : `Creating ${createLabel}…`);

    let data;
    let error;
    if (isEdit) {
      ({ data, error } = await sb
        .from("employees")
        .update(payload)
        .eq("id", editingEmployeeId)
        .select("*")
        .single());
    } else {
      const insertPayload = { ...payload, referral_code: referralCode(), avatar_url: null };
      ({ data, error } = await sb.from("employees").insert(insertPayload).select("*").single());
    }

    if (!error && data) {
      try {
        data = await applyPendingAvatar(data);
      } catch (avatarErr) {
        console.error(avatarErr);
        els.employeeSubmit.disabled = false;
        setBanner(avatarErr.message || "Saved details, but photo upload failed.", "err");
        rememberEmployees([data]);
        await loadDashboard({ skipCachePaint: true });
        return;
      }
    }

    els.employeeSubmit.disabled = false;

    if (error) {
      setBanner(error.message || (isEdit ? "Could not save volunteer." : "Could not create volunteer."), "err");
      return;
    }

    await closeAdminDialog(els.employeeDialog);
    editingEmployeeId = null;
    clearPendingAvatar();
    setBanner(isEdit ? `Updated ${personLabel(data)}.` : `Created ${personLabel(data)}.`, "ok");
    if (!isEdit) rememberEmployees([data]);
    await loadDashboard({ skipCachePaint: true });
    if (!isEdit) await openQrDialog(data);
  }

  async function duplicateEmployee(emp) {
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    const payload = {
      first_name: emp.first_name,
      last_name: `${emp.last_name} copy`.slice(0, 80),
      phone: emp.phone,
      payment_type: emp.payment_type,
      payment_handle: emp.payment_handle || null,
      referral_code: referralCode(),
      avatar_url: emp.avatar_url || null,
    };
    setBanner(`Duplicating ${emp.first_name}…`);
    const { data, error } = await sb.from("employees").insert(payload).select("*").single();
    if (error) {
      setBanner(error.message || "Could not duplicate volunteer.", "err");
      return;
    }
    setBanner(`Duplicated as ${data.first_name} ${data.last_name}.`, "ok");
    rememberEmployees([data]);
    await loadDashboard({ skipCachePaint: true });
    await openQrDialog(data);
  }

  function nextPlaceholderNumber() {
    let max = 0;
    for (const emp of latestEmployees || []) {
      const label = String(emp.first_name || "").trim();
      if (!/^\d+$/.test(label)) continue;
      const n = Number.parseInt(label, 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return max + 1;
  }

  async function addPlaceholderEmployees(count = 5) {
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    const start = nextPlaceholderNumber();
    const rows = Array.from({ length: count }, (_, i) => ({
      first_name: String(start + i),
      last_name: "",
      phone: "0000000000",
      payment_type: "other",
      payment_handle: null,
      referral_code: referralCode(),
      avatar_url: null,
    }));
    if (els.btnPlaceholders) els.btnPlaceholders.disabled = true;
    setBanner(`Adding ${count} placeholders…`);
    const { data, error } = await sb.from("employees").insert(rows).select("id, first_name");
    if (els.btnPlaceholders) els.btnPlaceholders.disabled = false;
    if (error) {
      setBanner(error.message || "Could not add placeholders.", "err");
      return;
    }
    const made = data?.length || count;
    const from = start;
    const to = start + made - 1;
    setBanner(
      made === 1 ? `Added placeholder ${from}.` : `Added placeholders ${from}–${to}.`,
      "ok"
    );
    rememberEmployees(data);
    await loadDashboard({ skipCachePaint: true });
  }

  function askConfirm({ title, lead, confirmLabel = "Delete" }) {
    const dialog = els.confirmDialog;
    if (!dialog) return Promise.resolve(window.confirm(`${title}\n\n${lead}`));

    return new Promise((resolve) => {
      if (els.confirmTitle) els.confirmTitle.textContent = title;
      if (els.confirmLead) els.confirmLead.textContent = lead;
      if (els.confirmOk) els.confirmOk.textContent = confirmLabel;

      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        dialog.removeEventListener("close", onClose);
        els.confirmCancel?.removeEventListener("click", onCancel);
        els.confirmOk?.removeEventListener("click", onOk);
        if (dialog.open) dialog.close();
        resolve(ok);
      };
      const onCancel = () => finish(false);
      const onOk = () => finish(true);
      const onClose = () => finish(false);

      els.confirmCancel?.addEventListener("click", onCancel);
      els.confirmOk?.addEventListener("click", onOk);
      dialog.addEventListener("close", onClose);
      if (typeof dialog.showModal === "function" && !dialog.open) {
        dialog.showModal();
      }
      els.confirmCancel?.focus();
    });
  }

  async function revokeEmployeeData(sb, emp) {
    const id = emp.id;
    const code = String(emp.referral_code || "").trim();

    const donationQ = sb.from("donations").delete();
    const { error: donErr } = code
      ? await donationQ.or(`employee_id.eq.${id},referral_code.eq.${code}`)
      : await donationQ.eq("employee_id", id);
    if (donErr) throw donErr;

    const visitQ = sb.from("visits").delete();
    const { error: visitErr } = code
      ? await visitQ.or(`employee_id.eq.${id},referral_code.eq.${code}`)
      : await visitQ.eq("employee_id", id);
    if (visitErr) throw visitErr;

    try {
      const { data: files } = await sb.storage.from(AVATAR_BUCKET).list(String(id));
      if (files?.length) {
        await sb.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${id}/${f.name}`));
      }
    } catch (storageErr) {
      console.warn("Avatar cleanup skipped", storageErr);
    }
  }

  async function deleteEmployee(emp) {
    const label = `${emp.first_name} ${emp.last_name}`.trim();
    if (readSettings().confirmDeletes) {
      const ok = await askConfirm({
        title: `Delete ${label}?`,
        lead: "This permanently removes their profile, QR attribution, donations, and visit history.",
        confirmLabel: "Delete everything",
      });
      if (!ok) return;
    }
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    setBanner(`Deleting ${label} and revoking their data…`);
    try {
      await revokeEmployeeData(sb, emp);
      const { error } = await sb.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
      setBanner(`Deleted ${label} and revoked their data.`, "ok");
      await loadDashboard({ skipCachePaint: true });
    } catch (err) {
      console.error(err);
      setBanner(err.message || "Could not delete volunteer.", "err");
    }
  }

  function wireDialogs() {
    wireDialogBackdropClose();
    wireAdminNav();
    wireSettings();
    wirePullToHardRefresh();
    els.btnNew?.addEventListener("click", openNewEmployee);
    els.btnPlaceholders?.addEventListener("click", () => addPlaceholderEmployees(5));
    els.visitsClose?.addEventListener("click", () => closeAdminDialog(els.visitsDialog));
    els.detailClose?.addEventListener("click", () => closeEmployeeDetail());
    els.statInfoClose?.addEventListener("click", () => closeAdminDialog(els.statInfoDialog));
    els.statsGrid?.querySelectorAll("[data-stat-info]").forEach((btn) => {
      btn.addEventListener("click", () => openStatInfo(btn.getAttribute("data-stat-info")));
    });
    els.donationCancel?.addEventListener("click", () => {
      editingDonationId = null;
      closeAdminDialog(els.donationDialog);
    });
    els.donationForm?.addEventListener("submit", saveDonation);
    els.empPayment?.addEventListener("change", () => {
      syncPaymentHandleField(els.empPayment.value);
    });
    els.empPhone?.addEventListener("input", () => applyPhoneInputFormat(els.empPhone));
    els.empPhone?.addEventListener("blur", () => applyPhoneInputFormat(els.empPhone));
    els.payoutCancel?.addEventListener("click", () => {
      payoutEmployee = null;
      closeAdminDialog(els.payoutDialog);
    });
    els.payoutForm?.addEventListener("submit", recordPayout);
    els.payoutDialog?.addEventListener("close", () => {
      payoutEmployee = null;
    });
    els.employeeCancel?.addEventListener("click", () => {
      editingEmployeeId = null;
      clearPendingAvatar();
      closeAdminDialog(els.employeeDialog);
    });
    els.employeeForm?.addEventListener("submit", saveEmployee);
    els.empAvatarFile?.addEventListener("change", () => {
      const file = els.empAvatarFile.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setBanner("Photo must be 2MB or smaller.", "err");
        els.empAvatarFile.value = "";
        return;
      }
      pendingAvatarFile = file;
      pendingAvatarReset = false;
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    });
    els.empAvatarReset?.addEventListener("click", () => {
      pendingAvatarFile = null;
      pendingAvatarReset = true;
      if (els.empAvatarFile) els.empAvatarFile.value = "";
      setAvatarPreview(DEFAULT_AVATAR);
    });

    document.getElementById("detail-avatar-pick")?.addEventListener("click", () => {
      if (!detailEmployee) return;
      els.detailAvatarFile?.click();
    });
    document.getElementById("detail-avatar-reset")?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!detailEmployee) return;
      await resetEmployeePhoto(detailEmployee);
    });
    els.detailAvatarFile?.addEventListener("change", async () => {
      const file = els.detailAvatarFile.files?.[0];
      els.detailAvatarFile.value = "";
      if (!file || !detailEmployee) return;
      await changeEmployeePhoto(detailEmployee, file);
    });

    els.detailDialog?.querySelectorAll("[data-detail]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const emp = detailEmployee;
        if (!emp) return;
        const action = btn.getAttribute("data-detail");
        if (action === "pay") {
          await openPayoutApp(emp);
          return;
        }
        if (action === "paid") {
          openPayoutDialog(emp);
          return;
        }
        if (action === "qr") {
          closeEmployeeDetail();
          await openQrDialog(emp);
          return;
        }
        if (action === "edit") {
          closeEmployeeDetail();
          openEditEmployee(emp);
          return;
        }
        if (action === "dupe") {
          closeEmployeeDetail();
          await duplicateEmployee(emp);
          return;
        }
        if (action === "visits") {
          const visits = latestVisitStats[emp.id] || { count: 0, places: {} };
          openVisitsDialog(emp, visits);
          return;
        }
        if (action === "delete") {
          closeEmployeeDetail();
          await deleteEmployee(emp);
        }
      });
    });

    els.qrClose?.addEventListener("click", () => closeAdminDialog(els.qrDialog));
    els.qrCopy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentQr.url);
        setBanner("Volunteer link copied.", "ok");
      } catch {
        setBanner("Could not copy link.", "err");
      }
    });
    els.qrDownload?.addEventListener("click", async () => {
      try {
        const dataUrl = await window.PfQr.toDataURL(currentQr.url, 512);
        window.PfQr.downloadDataUrl(dataUrl, `pawsforward-${currentQr.name || "qr"}.png`);
      } catch (err) {
        console.error(err);
        setBanner("Could not download QR.", "err");
      }
    });
  }

  function clearHardRefreshNote() {
    const el = document.getElementById("admin-status");
    if (el && /hard refreshing/i.test(el.textContent || "")) {
      el.hidden = true;
      el.textContent = "";
      el.removeAttribute("data-kind");
    }
    document.body.classList.remove("pf-pull-refreshing", "pf-pulling", "pf-pull-ready");
    document.body.style.removeProperty("--pf-pull");
    document.body.style.removeProperty("--pf-pull-progress");
    document.body.style.removeProperty("--pf-pull-reveal");
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
    next.searchParams.delete("_");
    next.searchParams.set("_", String(Date.now()));
    location.replace(next.toString());
  }

  function wirePullToHardRefresh() {
    const indicator = els.pullIndicator;
    const THRESHOLD = 96;
    const MAX_PULL = 148;
    const HOLD_PULL = 64;
    let startY = 0;
    let pulling = false;
    let armed = false;
    let triggered = false;
    let settleFrame = 0;
    let labelReady = false;

    function scrollTop() {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function sectionIsScrolled(target) {
      let node = target instanceof Element ? target : null;
      while (node && node !== document.body) {
        const overflowY = getComputedStyle(node).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
          node.scrollTop > 1
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    }

    function resisted(delta) {
      const stretched = Math.max(0, delta) * 0.62;
      return MAX_PULL * (1 - Math.exp(-stretched / 110));
    }

    function setPull(distance) {
      const clamped = Math.max(0, Math.min(MAX_PULL, distance));
      const progress = Math.min(1, clamped / THRESHOLD);
      const reveal = clamped <= 1 ? 0 : Math.min(1, 0.55 + progress * 0.45);
      const ready = clamped >= THRESHOLD;
      document.body.style.setProperty("--pf-pull", `${clamped}px`);
      document.body.style.setProperty("--pf-pull-progress", String(progress));
      document.body.style.setProperty("--pf-pull-reveal", String(reveal));
      document.body.classList.toggle("pf-pulling", clamped > 0.5);
      document.body.classList.toggle("pf-pull-ready", ready);
      if (indicator && ready !== labelReady) {
        labelReady = ready;
        const label = indicator.querySelector(".pf-pull-indicator-label");
        if (label) label.textContent = ready ? "Release to hard reset" : "Pull to hard reset";
      }
    }

    function cancelSettle() {
      if (!settleFrame) return;
      cancelAnimationFrame(settleFrame);
      settleFrame = 0;
    }

    function settlePull(to) {
      cancelSettle();
      if (prefersReducedMotion()) {
        setPull(to);
        if (to <= 0) endPull(true);
        return;
      }
      const from = Number.parseFloat(document.body.style.getPropertyValue("--pf-pull")) || 0;
      const start = performance.now();
      const duration = 480;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setPull(from + (to - from) * ease(t));
        if (t < 1) {
          settleFrame = requestAnimationFrame(step);
          return;
        }
        settleFrame = 0;
        if (to <= 0) endPull(true);
      };
      settleFrame = requestAnimationFrame(step);
    }

    function endPull(immediate) {
      pulling = false;
      armed = false;
      if (!immediate && !triggered) {
        settlePull(0);
        return;
      }
      labelReady = false;
      cancelSettle();
      document.body.classList.remove("pf-pulling", "pf-pull-ready");
      document.body.style.removeProperty("--pf-pull");
      document.body.style.removeProperty("--pf-pull-progress");
      document.body.style.removeProperty("--pf-pull-reveal");
    }

    const onStart = (clientY, event) => {
      if (triggered || scrollTop() > 2) return;
      if (document.querySelector("dialog[open]")) return;
      if (sectionIsScrolled(event?.target)) return;
      cancelSettle();
      startY = clientY;
      pulling = true;
      armed = false;
    };

    const onMove = (clientY, event) => {
      if (!pulling || triggered) return;
      if (sectionIsScrolled(event?.target) || (scrollTop() > 2 && !armed)) {
        pulling = false;
        armed = false;
        setPull(0);
        return;
      }
      const delta = clientY - startY;
      if (delta <= 8) {
        setPull(0);
        return;
      }
      armed = true;
      if (event?.cancelable) event.preventDefault();
      setPull(resisted(delta - 8));
    };

    const onEnd = () => {
      if (!pulling || triggered) return;
      pulling = false;
      armed = false;
      const distance = Number.parseFloat(document.body.style.getPropertyValue("--pf-pull")) || 0;
      if (distance >= THRESHOLD) {
        triggered = true;
        settlePull(HOLD_PULL);
        window.setTimeout(() => {
          document.body.classList.add("pf-pull-refreshing");
          void hardRefresh();
        }, 220);
        return;
      }
      settlePull(0);
    };

    window.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        onStart(event.touches[0].clientY, event);
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length !== 1) return;
        onMove(event.touches[0].clientY, event);
      },
      { passive: false }
    );
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", endPull, { passive: true });
  }

  window.addEventListener("pageshow", clearHardRefreshNote);

  document.addEventListener("DOMContentLoaded", async () => {
    clearHardRefreshNote();
    if (!window.SitePin?.requireUnlock?.()) return;

    const auth = await window.SiteSupabase?.requireAdminSession?.();
    if (!auth?.ok) {
      await window.SitePin?.lock?.();
      location.replace("/login?next=admin");
      return;
    }

    document.body.classList.add("site-unlocked");
    document.getElementById("admin-lock-btn")?.addEventListener("click", async () => {
      const settings = readSettings();
      settings.autoLogin = false;
      writeSettings(settings);
      await window.SitePin?.lock?.();
      location.replace("/login");
    });
    window.PfShell?.renderShell("dashboard");
    wireDialogs();
    window.SiteIcons?.initIcons?.();
    requestAnimationFrame(() => finishAdminBoot());
    await loadDashboard();
  });
})();
