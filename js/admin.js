(function () {
  const COMMISSION = () => Number(window.SITE_CONFIG?.commissionRate ?? 0.25);
  const CACHE_KEY = "pf_admin_cache_v1";

  const els = {
    banner: document.getElementById("status-banner"),
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
    empAvatarPreview: document.getElementById("emp-avatar-preview"),
    empAvatarFile: document.getElementById("emp-avatar-file"),
    empAvatarReset: document.getElementById("emp-avatar-reset"),
    btnNew: document.getElementById("btn-new-employee"),
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
    detailLead: document.getElementById("employee-detail-lead"),
    detailPhone: document.getElementById("employee-detail-phone"),
    detailAvatar: document.getElementById("detail-avatar"),
    detailVisits: document.getElementById("detail-visits"),
    detailRaised: document.getElementById("detail-raised"),
    detailOwed: document.getElementById("detail-owed"),
    detailPayout: document.getElementById("detail-payout"),
    detailClose: document.getElementById("employee-detail-close"),
    detailAvatarFile: document.getElementById("detail-avatar-file"),
    statsGrid: document.getElementById("stats-grid"),
    statInfoDialog: document.getElementById("stat-info-dialog"),
    statInfoTitle: document.getElementById("stat-info-title"),
    statInfoLead: document.getElementById("stat-info-lead"),
    statInfoList: document.getElementById("stat-info-list"),
    statInfoClose: document.getElementById("stat-info-close"),
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
  let latestVisits = [];
  let latestVisitStats = {};
  let latestDonationStats = {};
  let latestSnapshot = {
    donors: 0,
    donors24h: 0,
    raised: 0,
    attributedRaised: 0,
    owed: 0,
    visits: 0,
  };
  let detailEmployee = null;
  let editingDonationId = null;
  let editingEmployeeId = null;
  let pendingAvatarFile = null;
  let pendingAvatarReset = false;
  const ADMIN_PAGE_KEY = "pf_admin_page_v1";

  const ADMIN_PAGES = ["activity", "employees", "donations"];
  let adminPageBusy = false;

  function normalizeAdminPage(pageId) {
    if (pageId === "inbox") return "donations";
    return ADMIN_PAGES.includes(pageId) ? pageId : "activity";
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function syncAdminNav(next) {
    document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
      const active = btn.getAttribute("data-admin-nav") === next;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
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
      return;
    }

    adminPageBusy = true;
    syncAdminNav(next);
    current.classList.add("is-exit");
    current.classList.remove("is-active");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 180);
    });
    current.hidden = true;
    current.classList.remove("is-exit");

    incoming.hidden = false;
    incoming.classList.add("is-active", "is-enter");
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });
    incoming.classList.remove("is-enter");
    adminPageBusy = false;
  }

  function wireAdminNav() {
    document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
      btn.addEventListener("click", () => setAdminPage(btn.getAttribute("data-admin-nav")));
    });
    let initial = "activity";
    try {
      initial = sessionStorage.getItem(ADMIN_PAGE_KEY) || "activity";
    } catch {
      /* ignore */
    }
    setAdminPage(normalizeAdminPage(initial), { instant: true });
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

  function setFieldError(el, msg) {
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function employeeShareUrl(code) {
    const supabase = String(window.SITE_CONFIG?.supabaseUrl || "").replace(/\/$/, "");
    const ref = String(code || "").trim();
    // QR opens create-checkout, which 303s straight into Stripe Checkout.
    if (supabase && ref) {
      return `${supabase}/functions/v1/create-checkout?ref=${encodeURIComponent(ref)}`;
    }
    const origin = String(window.SITE_CONFIG?.siteOrigin || "").replace(/\/$/, "");
    const base = origin ? `${origin}/donate.html` : new URL("donate.html", window.location.href).href;
    const u = new URL(base);
    if (ref) u.searchParams.set("ref", ref);
    return u.href;
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

  async function payEmployee(emp) {
    const target = payoutTarget(emp);
    const name = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "employee";
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
      return;
    }
    if (target.copy) {
      setBanner(`Copied payout info for ${name} (${target.label}).`, "ok");
      return;
    }
    setBanner(`Add a payout handle for ${name} in Edit details.`, "err");
  }

  function enableDialogBackdropClose(dialog) {
    if (!dialog || dialog.dataset.backdropClose === "1") return;
    dialog.dataset.backdropClose = "1";
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  function wireDialogBackdropClose() {
    document.querySelectorAll("dialog.pf-dialog, dialog.site-leave-dialog").forEach(enableDialogBackdropClose);
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

  function formatPlace(parts) {
    const cleaned = [parts.city, parts.region, parts.country].filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : "";
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
    if (els.skeleton) els.skeleton.hidden = !isLoading;
    if (els.content) els.content.classList.toggle("is-loading", isLoading);
  }

  async function openQrDialog(employee) {
    const url = employeeShareUrl(employee.referral_code);
    currentQr = {
      url,
      name: `${employee.first_name}-${employee.last_name}`.replace(/\s+/g, "-"),
    };
    els.qrLead.textContent = `QR for ${employee.first_name} ${employee.last_name}. Opens Stripe Checkout directly (any amount) and attributes the gift to code ${employee.referral_code}.`;
    els.qrLinkText.textContent = url;
    els.qrHost.innerHTML = "";
    els.qrDialog.showModal();
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
        : "No visits recorded for this employee yet.";
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
    els.visitsDialog.showModal();
  }

  function fillEmployeeDetail(emp) {
    detailEmployee = emp;
    const stats = latestDonationStats[emp.id] || { count: 0, raised: 0 };
    const visits = latestVisitStats[emp.id] || { count: 0, places: {} };
    const owed = stats.raised * COMMISSION();
    const handle = normalizeHandle(emp.payment_handle);
    const payout = handle
      ? `${paymentLabel(emp.payment_type)} · ${handle}`
      : paymentLabel(emp.payment_type);

    if (els.detailAvatar) {
      els.detailAvatar.src = avatarUrl(emp);
      els.detailAvatar.onerror = () => {
        els.detailAvatar.src = DEFAULT_AVATAR;
      };
    }
    if (els.detailTitle) els.detailTitle.textContent = `${emp.first_name} ${emp.last_name}`.trim();
    if (els.detailPhone) els.detailPhone.textContent = emp.phone || "No phone on file";
    if (els.detailLead) {
      els.detailLead.textContent = emp.referral_code || "No referral code";
    }
    if (els.detailVisits) els.detailVisits.textContent = String(visits.count || 0);
    if (els.detailRaised) els.detailRaised.textContent = money(stats.raised);
    if (els.detailOwed) els.detailOwed.textContent = money(owed);
    if (els.detailPayout) els.detailPayout.textContent = payout;
  }

  function openEmployeeDetail(emp) {
    if (!els.detailDialog) return;
    fillEmployeeDetail(emp);
    els.detailDialog.showModal();
  }

  function closeEmployeeDetail() {
    detailEmployee = null;
    if (els.detailDialog?.open) els.detailDialog.close();
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
      const owed = stats.raised * COMMISSION();
      const li = document.createElement("li");
      li.className = "pf-employee-row";
      li.dataset.employeeId = emp.id;
      li.innerHTML = `
        <div class="pf-employee-identity">
          <img class="pf-avatar" src="${escapeHtml(avatarUrl(emp))}" alt="" width="36" height="36" loading="lazy" onerror="this.src='doc/default-avatar.jpg'">
          <div class="pf-employee-main">
            <strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong>
            <div class="pf-employee-stats" aria-label="Employee snapshot">
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Visits</span><span class="pf-stat-chip-value">${visits.count}</span></span>
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Raised</span><span class="pf-stat-chip-value">${money(stats.raised)}</span></span>
              <span class="pf-stat-chip"><span class="pf-stat-chip-label">Owed</span><span class="pf-stat-chip-value">${money(owed)}</span></span>
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
      const attributed = emp
        ? `${emp.first_name} ${emp.last_name}`
        : d.referral_code
          ? `Code ${d.referral_code}`
          : "General (no employee)";
      const donor = d.donor_label || "Anonymous";
      const place = locationIndex?.forDonation(d) || "";
      const channel = emp || d.referral_code ? "Employee QR" : "Direct";
      const li = document.createElement("li");
      li.className = "pf-donation-row";
      li.dataset.donationId = d.id;
      li.innerHTML = `
        <div class="pf-donation-top">
          <strong>${escapeHtml(donor)}</strong>
          <span class="feed-amount">${money(d.amount)}</span>
        </div>
        <dl class="pf-donation-details">
          <div><dt>When</dt><dd>${escapeHtml(absoluteTime(d.created_at))} <span class="pf-muted">(${escapeHtml(relativeTime(d.created_at))})</span></dd></div>
          <div><dt>Attributed to</dt><dd>${escapeHtml(attributed)}</dd></div>
          <div><dt>Via</dt><dd>${escapeHtml(channel)}</dd></div>
          <div><dt>Where</dt><dd>${escapeHtml(place || "Location unknown")}</dd></div>
          ${d.referral_code ? `<div><dt>Code</dt><dd><code>${escapeHtml(d.referral_code)}</code></dd></div>` : ""}
        </dl>
        <div class="pf-donation-actions">
          <button type="button" class="pf-chip-btn" data-don-action="edit">Edit</button>
          <button type="button" class="pf-chip-btn pf-chip-btn--danger" data-don-action="delete">Delete</button>
        </div>
      `;
      li.querySelector('[data-don-action="edit"]')?.addEventListener("click", () => openEditDonation(d));
      li.querySelector('[data-don-action="delete"]')?.addEventListener("click", () => deleteDonation(d));
      feed.appendChild(li);
    });
  }

  function fillDonationEmployeeOptions(selectedId) {
    if (!els.donEmployee) return;
    const current = selectedId || "";
    els.donEmployee.innerHTML = `<option value="">General (no employee)</option>`;
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
    els.donationDialog.showModal();
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
      els.donationDialog?.close();
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
          `${attributedCount} attributed to an employee`,
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
          `${money(latestSnapshot.attributedRaised)} attributed to employees`,
          `${money(latestSnapshot.raised - latestSnapshot.attributedRaised)} general / unattributed`,
          `${latestSnapshot.donors} gifts counted`,
        ],
      },
      owed: {
        title: "Owed",
        lead: `Employee commission on attributed gifts (${rate}%).`,
        items: [
          `${money(latestSnapshot.owed)} currently owed`,
          `Based on ${money(latestSnapshot.attributedRaised)} attributed raised`,
          `Commission rate ${rate}%`,
          "General gifts do not create employee owed balance",
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
      title: "Activity",
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
    els.statInfoDialog.showModal();
  }

  function renderGeo(visits) {
    const counts = new Map();
    visits.forEach((v) => {
      const key = formatPlace(v) || "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7);
    if (!els.geoChart) return;
    els.geoChart.innerHTML = "";
    if (!ranked.length) {
      if (els.geoEmpty) els.geoEmpty.hidden = false;
      return;
    }
    if (els.geoEmpty) els.geoEmpty.hidden = true;

    const max = ranked[0][1] || 1;
    const rowH = 22;
    const labelW = 108;
    const gap = 8;
    const chartW = 300;
    const barMax = chartW - labelW - 28;
    const height = ranked.length * rowH + 4;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${chartW} ${height}`);
    svg.setAttribute("class", "pf-geo-svg");
    svg.setAttribute("role", "presentation");

    ranked.forEach(([label, count], i) => {
      const y = i * rowH + 2;
      const barW = Math.max(4, Math.round((count / max) * barMax));
      const short = label.length > 18 ? label.slice(0, 16) + "…" : label;

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", String(y + 12));
      text.setAttribute("class", "pf-geo-label");
      text.textContent = short;
      text.appendChild(document.createElementNS(ns, "title")).textContent = `${label}: ${count}`;
      svg.appendChild(text);

      const track = document.createElementNS(ns, "rect");
      track.setAttribute("x", String(labelW));
      track.setAttribute("y", String(y + 4));
      track.setAttribute("width", String(barMax));
      track.setAttribute("height", "9");
      track.setAttribute("rx", "5");
      track.setAttribute("class", "pf-geo-track");
      svg.appendChild(track);

      const bar = document.createElementNS(ns, "rect");
      bar.setAttribute("x", String(labelW));
      bar.setAttribute("y", String(y + 4));
      bar.setAttribute("width", String(barW));
      bar.setAttribute("height", "9");
      bar.setAttribute("rx", "5");
      bar.setAttribute("class", "pf-geo-bar");
      svg.appendChild(bar);

      const countText = document.createElementNS(ns, "text");
      countText.setAttribute("x", String(labelW + barW + gap));
      countText.setAttribute("y", String(y + 12));
      countText.setAttribute("class", "pf-geo-count");
      countText.textContent = String(count);
      svg.appendChild(countText);
    });

    els.geoChart.appendChild(svg);
  }

  function applyDashboardData({ employees, donations, visits, donors24h }) {
    const donationStats = {};
    let raisedTotal = 0;
    donations.forEach((d) => {
      raisedTotal += Number(d.amount) || 0;
      if (!d.employee_id) return;
      if (!donationStats[d.employee_id]) donationStats[d.employee_id] = { count: 0, raised: 0 };
      donationStats[d.employee_id].count += 1;
      donationStats[d.employee_id].raised += Number(d.amount) || 0;
    });
    const attributedRaised = Object.values(donationStats).reduce((s, x) => s + x.raised, 0);
    const owedTotal = attributedRaised * COMMISSION();

    latestEmployees = employees;
    latestDonations = donations;
    latestVisits = visits;
    latestSnapshot = {
      donors: donations.length,
      donors24h: donors24h ?? 0,
      raised: raisedTotal,
      attributedRaised,
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
    } else {
      setLoading(true);
      setBanner("Loading…");
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let empRes, donRes, visitRes, don24Res;
    try {
      const timed = Promise.race([
        Promise.all([
          sb.from("employees").select("*").order("created_at", { ascending: false }),
          sb.from("donations").select("*").order("created_at", { ascending: false }).limit(200),
          sb.from("visits").select("city,region,country,created_at,referral_code,employee_id").order("created_at", { ascending: false }).limit(1000),
          sb.from("donations").select("id", { count: "exact", head: true }).gte("created_at", since24h),
        ]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timed out loading dashboard data.")), 12000)
        ),
      ]);
      [empRes, donRes, visitRes, don24Res] = await timed;
    } catch (err) {
      setLoading(false);
      setBanner(err.message || "Failed to load data.", "err");
      console.error(err);
      return;
    }

    if (empRes.error || donRes.error || visitRes.error) {
      setLoading(false);
      const err = empRes.error || donRes.error || visitRes.error;
      setBanner(err.message || "Failed to load data. Sign in again if this persists.", "err");
      console.error(empRes.error, donRes.error, visitRes.error);
      return;
    }

    const payload = {
      employees: empRes.data || [],
      donations: donRes.data || [],
      visits: visitRes.data || [],
      donors24h: don24Res.count ?? 0,
    };
    writeCache(payload);
    applyDashboardData(payload);
    setLoading(false);
    setBanner("", null);
  }

  function clearEmployeeErrors() {
    setFieldError(els.errFirst, "");
    setFieldError(els.errLast, "");
    setFieldError(els.errPhone, "");
    setFieldError(els.errPayment, "");
    setFieldError(els.errHandle, "");
  }

  function readEmployeeForm() {
    const fd = new FormData(els.employeeForm);
    const handle = normalizeHandle(fd.get("payment_handle"));
    return {
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      payment_type: String(fd.get("payment_type") || "").trim(),
      payment_handle: handle,
    };
  }

  function validateEmployeeForm(payload) {
    clearEmployeeErrors();
    let bad = false;
    if (!payload.first_name) {
      setFieldError(els.errFirst, "Enter a first name.");
      bad = true;
    }
    if (!payload.last_name) {
      setFieldError(els.errLast, "Enter a last name.");
      bad = true;
    }
    if (!payload.phone) {
      setFieldError(els.errPhone, "Enter a phone number.");
      bad = true;
    }
    if (!payload.payment_type) {
      setFieldError(els.errPayment, "Choose a payment type.");
      bad = true;
    }
    if (!payload.payment_handle) {
      setFieldError(els.errHandle, "Enter a payout handle.");
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
    els.empPayment.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function openNewEmployee() {
    editingEmployeeId = null;
    clearPendingAvatar();
    els.employeeForm.reset();
    if (els.empId) els.empId.value = "";
    clearEmployeeErrors();
    setAvatarPreview(DEFAULT_AVATAR);
    if (els.employeeTitle) els.employeeTitle.textContent = "New employee";
    if (els.employeeLead) els.employeeLead.textContent = "Add a hire and generate their Stripe donation QR.";
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Create & generate QR";
    setPaymentSelect("");
    if (els.empPaymentHandle) els.empPaymentHandle.value = "";
    els.employeeDialog.showModal();
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
    if (els.empPhone) els.empPhone.value = emp.phone || "";
    setPaymentSelect(emp.payment_type || "");
    if (els.empPaymentHandle) els.empPaymentHandle.value = emp.payment_handle || "";
    setAvatarPreview(avatarUrl(emp));
    if (els.employeeTitle) els.employeeTitle.textContent = "Edit employee";
    if (els.employeeLead) {
      els.employeeLead.textContent = "Rename, update payout details, or change their photo. QR code stays the same.";
    }
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Save changes";
    els.employeeDialog.showModal();
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
    setBanner(isEdit ? "Saving…" : `Creating ${payload.first_name}…`);

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
        await loadDashboard({ skipCachePaint: true });
        return;
      }
    }

    els.employeeSubmit.disabled = false;

    if (error) {
      setBanner(error.message || (isEdit ? "Could not save employee." : "Could not create employee."), "err");
      return;
    }

    els.employeeDialog.close();
    editingEmployeeId = null;
    clearPendingAvatar();
    setBanner(
      isEdit
        ? `Updated ${data.first_name} ${data.last_name}.`
        : `Created ${data.first_name} ${data.last_name}.`,
      "ok"
    );
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
      setBanner(error.message || "Could not duplicate employee.", "err");
      return;
    }
    setBanner(`Duplicated as ${data.first_name} ${data.last_name}.`, "ok");
    await loadDashboard({ skipCachePaint: true });
    await openQrDialog(data);
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
      dialog.showModal();
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
    const ok = await askConfirm({
      title: `Delete ${label}?`,
      lead: "This permanently removes their profile, QR attribution, donations, and visit history.",
      confirmLabel: "Delete everything",
    });
    if (!ok) return;
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
      setBanner(err.message || "Could not delete employee.", "err");
    }
  }

  function wireDialogs() {
    wireDialogBackdropClose();
    wireAdminNav();
    wirePullToHardRefresh();
    els.btnNew?.addEventListener("click", openNewEmployee);
    els.visitsClose?.addEventListener("click", () => els.visitsDialog?.close());
    els.detailClose?.addEventListener("click", () => closeEmployeeDetail());
    els.statInfoClose?.addEventListener("click", () => els.statInfoDialog?.close());
    els.statsGrid?.querySelectorAll("[data-stat-info]").forEach((btn) => {
      btn.addEventListener("click", () => openStatInfo(btn.getAttribute("data-stat-info")));
    });
    els.donationCancel?.addEventListener("click", () => {
      editingDonationId = null;
      els.donationDialog?.close();
    });
    els.donationForm?.addEventListener("submit", saveDonation);
    els.employeeCancel?.addEventListener("click", () => {
      editingEmployeeId = null;
      clearPendingAvatar();
      els.employeeDialog.close();
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
          await payEmployee(emp);
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
        if (action === "copy") {
          try {
            await navigator.clipboard.writeText(String(emp.referral_code || ""));
            setBanner(`Copied referral code for ${emp.first_name}.`, "ok");
          } catch {
            setBanner("Could not copy code.", "err");
          }
          return;
        }
        if (action === "dupe") {
          closeEmployeeDetail();
          await duplicateEmployee(emp);
          return;
        }
        if (action === "photo") {
          els.detailAvatarFile?.click();
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

    els.qrClose?.addEventListener("click", () => els.qrDialog.close());
    els.qrCopy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentQr.url);
        setBanner("Employee link copied.", "ok");
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

  async function hardRefresh() {
    setBanner("Hard refreshing…");
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
      if (indicator) {
        const label = indicator.querySelector(".pf-pull-indicator-label");
        if (label) {
          label.textContent =
            distance >= THRESHOLD ? "Release to hard reset" : "Pull to hard reset";
        }
      }
    }

    function endPull() {
      pulling = false;
      armed = false;
      document.body.classList.remove("pf-pulling", "pf-pull-ready");
      document.body.style.removeProperty("--pf-pull");
      document.body.style.removeProperty("--pf-pull-progress");
    }

    const onStart = (clientY) => {
      if (triggered || scrollTop() > 2) return;
      if (document.querySelector("dialog[open]")) return;
      startY = clientY;
      pulling = true;
      armed = false;
    };

    const onMove = (clientY, event) => {
      if (!pulling || triggered) return;
      if (scrollTop() > 2 && !armed) {
        endPull();
        return;
      }
      const delta = clientY - startY;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      armed = true;
      if (event?.cancelable) event.preventDefault();
      setPull(delta * 0.55);
    };

    const onEnd = () => {
      if (!pulling || triggered) return;
      const distance = Number.parseFloat(document.body.style.getPropertyValue("--pf-pull")) || 0;
      if (distance >= THRESHOLD) {
        triggered = true;
        document.body.classList.add("pf-pull-refreshing");
        void hardRefresh();
        return;
      }
      endPull();
    };

    window.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        onStart(event.touches[0].clientY);
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

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.SitePin?.requireUnlock?.()) return;

    document.body.classList.add("site-unlocked");
    window.PfShell?.renderShell("dashboard");
    wireDialogs();
    window.SiteIcons?.initIcons?.();
    await loadDashboard();
  });
})();
