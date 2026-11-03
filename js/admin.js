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
    empAvatarPreview: document.getElementById("emp-avatar-preview"),
    empAvatarFile: document.getElementById("emp-avatar-file"),
    empAvatarReset: document.getElementById("emp-avatar-reset"),
    btnNew: document.getElementById("btn-new-employee"),
    btnNewSecondary: document.getElementById("btn-new-employee-secondary"),
    btnRefresh: document.getElementById("btn-refresh"),
    errFirst: document.getElementById("err-emp-first"),
    errLast: document.getElementById("err-emp-last"),
    errPhone: document.getElementById("err-emp-phone"),
    errPayment: document.getElementById("err-emp-payment"),
    qrDialog: document.getElementById("qr-dialog"),
    qrLead: document.getElementById("qr-dialog-lead"),
    qrHost: document.getElementById("qr-canvas-host"),
    qrLinkText: document.getElementById("qr-link-text"),
    qrCopy: document.getElementById("qr-copy-link"),
    qrDownload: document.getElementById("qr-download"),
    qrClose: document.getElementById("qr-close"),
  };

  const DEFAULT_AVATAR = "doc/default-avatar.jpg";
  const AVATAR_BUCKET = "employee-avatars";

  let currentQr = { url: "", name: "" };
  let latestEmployees = [];
  let editingEmployeeId = null;
  let pendingAvatarFile = null;
  let pendingAvatarReset = false;

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
    const u = new URL("admin.html", window.location.href);
    const ref = String(code || "").trim();
    if (ref) u.searchParams.set("ref", ref);
    return u.href;
  }

  function paymentLabel(type) {
    const map = {
      cashapp: "Cash App",
      venmo: "Venmo",
      paypal: "PayPal",
      zelle: "Zelle",
      other: "Other",
    };
    return map[type] || type || "—";
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
    els.qrLead.textContent = `QR for ${employee.first_name} ${employee.last_name}. Shares their referral code (${employee.referral_code}).`;
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

  function renderEmployees(employees, donationStats) {
    latestEmployees = employees;
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
      const owed = stats.raised * COMMISSION();
      const li = document.createElement("li");
      li.className = "pf-employee-row";
      li.dataset.employeeId = emp.id;
      li.innerHTML = `
        <div class="pf-employee-identity">
          <button type="button" class="pf-avatar-btn" data-action="photo" title="Change photo" aria-label="Change photo for ${escapeHtml(emp.first_name)}">
            <img class="pf-avatar" src="${escapeHtml(avatarUrl(emp))}" alt="" width="40" height="40" loading="lazy" onerror="this.src='doc/default-avatar.jpg'">
          </button>
          <div class="pf-employee-main">
            <strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong>
            <span class="pf-employee-meta">${escapeHtml(paymentLabel(emp.payment_type))} · ${escapeHtml(emp.phone)}</span>
            <span class="pf-employee-meta">${stats.count} gifts · ${money(stats.raised)} raised · ${money(owed)} owed</span>
          </div>
        </div>
        <div class="pf-employee-actions">
          <div class="pf-emp-menu">
            <button type="button" class="btn secondary btn-sm pf-emp-menu-toggle" data-action="menu" aria-expanded="false" aria-haspopup="menu">Edit</button>
            <div class="pf-emp-menu-panel" role="menu" hidden>
              <button type="button" class="pf-emp-menu-item" role="menuitem" data-action="edit">Edit details</button>
              <button type="button" class="pf-emp-menu-item" role="menuitem" data-action="copy-link">Copy code</button>
              <button type="button" class="pf-emp-menu-item" role="menuitem" data-action="dupe">Duplicate</button>
              <button type="button" class="pf-emp-menu-item" role="menuitem" data-action="photo-menu">Change photo</button>
            </div>
          </div>
          <button type="button" class="btn secondary btn-sm" data-action="view-qr">QR</button>
          <button type="button" class="btn secondary btn-sm pf-btn-danger" data-action="delete">Delete</button>
        </div>
        <input type="file" class="pf-avatar-file-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
      `;
      const fileInput = li.querySelector(".pf-avatar-file-input");
      const menu = li.querySelector(".pf-emp-menu");
      const menuToggle = li.querySelector('[data-action="menu"]');
      const menuPanel = li.querySelector(".pf-emp-menu-panel");

      function closeMenu() {
        if (!menuPanel || menuPanel.hidden) return;
        menuPanel.hidden = true;
        menuToggle?.setAttribute("aria-expanded", "false");
        menu?.classList.remove("is-open");
      }

      function openMenu() {
        document.querySelectorAll(".pf-emp-menu.is-open").forEach((el) => {
          if (el === menu) return;
          el.classList.remove("is-open");
          const panel = el.querySelector(".pf-emp-menu-panel");
          const toggle = el.querySelector(".pf-emp-menu-toggle");
          if (panel) panel.hidden = true;
          toggle?.setAttribute("aria-expanded", "false");
        });
        menuPanel.hidden = false;
        menuToggle.setAttribute("aria-expanded", "true");
        menu.classList.add("is-open");
      }

      async function changePhoto(file) {
        if (!file) return;
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
        } catch (err) {
          console.error(err);
          setBanner(err.message || "Could not update photo.", "err");
        }
      }

      li.querySelector('[data-action="photo"]').addEventListener("click", () => fileInput.click());
      li.querySelector('[data-action="photo-menu"]').addEventListener("click", () => {
        closeMenu();
        fileInput.click();
      });
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        fileInput.value = "";
        await changePhoto(file);
      });
      menuToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menuPanel.hidden) openMenu();
        else closeMenu();
      });
      li.querySelector('[data-action="edit"]').addEventListener("click", () => {
        closeMenu();
        openEditEmployee(emp);
      });
      li.querySelector('[data-action="dupe"]').addEventListener("click", () => {
        closeMenu();
        duplicateEmployee(emp);
      });
      li.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEmployee(emp));
      li.querySelector('[data-action="view-qr"]').addEventListener("click", () => openQrDialog(emp));
      li.querySelector('[data-action="copy-link"]').addEventListener("click", async () => {
        closeMenu();
        try {
          await navigator.clipboard.writeText(String(emp.referral_code || ""));
          setBanner(`Copied referral code for ${emp.first_name}.`, "ok");
        } catch {
          setBanner("Could not copy code.", "err");
        }
      });
      body.appendChild(li);
    });
  }

  function renderDonations(rows, employeeMap, locationIndex) {
    const feed = els.donationsFeed;
    if (!feed) return;
    feed.innerHTML = "";
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
      `;
      feed.appendChild(li);
    });
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
    const rowH = 28;
    const labelW = 118;
    const gap = 10;
    const chartW = 320;
    const barMax = chartW - labelW - 36;
    const height = ranked.length * rowH + 8;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${chartW} ${height}`);
    svg.setAttribute("class", "pf-geo-svg");
    svg.setAttribute("role", "presentation");

    ranked.forEach(([label, count], i) => {
      const y = i * rowH + 4;
      const barW = Math.max(4, Math.round((count / max) * barMax));
      const short = label.length > 18 ? label.slice(0, 16) + "…" : label;

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", String(y + 14));
      text.setAttribute("class", "pf-geo-label");
      text.textContent = short;
      text.appendChild(document.createElementNS(ns, "title")).textContent = `${label}: ${count}`;
      svg.appendChild(text);

      const track = document.createElementNS(ns, "rect");
      track.setAttribute("x", String(labelW));
      track.setAttribute("y", String(y + 4));
      track.setAttribute("width", String(barMax));
      track.setAttribute("height", "12");
      track.setAttribute("rx", "6");
      track.setAttribute("class", "pf-geo-track");
      svg.appendChild(track);

      const bar = document.createElementNS(ns, "rect");
      bar.setAttribute("x", String(labelW));
      bar.setAttribute("y", String(y + 4));
      bar.setAttribute("width", String(barW));
      bar.setAttribute("height", "12");
      bar.setAttribute("rx", "6");
      bar.setAttribute("class", "pf-geo-bar");
      svg.appendChild(bar);

      const countText = document.createElementNS(ns, "text");
      countText.setAttribute("x", String(labelW + barW + gap));
      countText.setAttribute("y", String(y + 14));
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

    if (els.totalDonors) els.totalDonors.textContent = String(donations.length);
    if (els.donors24h) els.donors24h.textContent = String(donors24h ?? 0);
    if (els.totalDonated) els.totalDonated.textContent = money(raisedTotal);
    if (els.totalOwed) els.totalOwed.textContent = money(attributedRaised * COMMISSION());
    if (els.totalVisits) els.totalVisits.textContent = String(visits.length);

    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    const locationIndex = buildLocationIndex(visits);
    renderEmployees(employees, donationStats);
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
  }

  function readEmployeeForm() {
    const fd = new FormData(els.employeeForm);
    return {
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      payment_type: String(fd.get("payment_type") || "").trim(),
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
    return !bad;
  }

  function setPaymentSelect(value) {
    if (!els.empPayment) return;
    els.empPayment.value = value || "";
    window.UiSelect?.initAll(els.employeeForm);
  }

  function openNewEmployee() {
    editingEmployeeId = null;
    clearPendingAvatar();
    els.employeeForm.reset();
    if (els.empId) els.empId.value = "";
    clearEmployeeErrors();
    setAvatarPreview(DEFAULT_AVATAR);
    if (els.employeeTitle) els.employeeTitle.textContent = "New employee";
    if (els.employeeLead) els.employeeLead.textContent = "Add a hire and generate their donation QR.";
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Create & generate QR";
    setPaymentSelect("");
    els.employeeDialog.showModal();
    els.empFirst?.focus();
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
    setAvatarPreview(avatarUrl(emp));
    if (els.employeeTitle) els.employeeTitle.textContent = "Edit employee";
    if (els.employeeLead) {
      els.employeeLead.textContent = "Rename, update details, or change their photo. QR code stays the same.";
    }
    if (els.employeeSubmit) els.employeeSubmit.textContent = "Save changes";
    els.employeeDialog.showModal();
    els.empFirst?.focus();
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

  async function deleteEmployee(emp) {
    const label = `${emp.first_name} ${emp.last_name}`.trim();
    const ok = window.confirm(
      `Delete ${label}? Their QR stops attributing new gifts. Past donations stay in the inbox.`
    );
    if (!ok) return;
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }
    setBanner(`Deleting ${label}…`);
    const { error } = await sb.from("employees").delete().eq("id", emp.id);
    if (error) {
      setBanner(error.message || "Could not delete employee.", "err");
      return;
    }
    setBanner(`Deleted ${label}.`, "ok");
    await loadDashboard({ skipCachePaint: true });
  }

  function wireDialogs() {
    els.btnNew?.addEventListener("click", openNewEmployee);
    els.btnNewSecondary?.addEventListener("click", openNewEmployee);
    els.btnRefresh?.addEventListener("click", () => loadDashboard({ skipCachePaint: true }));
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

    document.addEventListener("click", (e) => {
      if (e.target.closest(".pf-emp-menu")) return;
      document.querySelectorAll(".pf-emp-menu.is-open").forEach((el) => {
        el.classList.remove("is-open");
        const panel = el.querySelector(".pf-emp-menu-panel");
        const toggle = el.querySelector(".pf-emp-menu-toggle");
        if (panel) panel.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".pf-emp-menu.is-open").forEach((el) => {
        el.classList.remove("is-open");
        const panel = el.querySelector(".pf-emp-menu-panel");
        const toggle = el.querySelector(".pf-emp-menu-toggle");
        if (panel) panel.hidden = true;
        toggle?.setAttribute("aria-expanded", "false");
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

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.SitePin?.requireUnlock?.()) return;

    document.body.classList.add("site-unlocked");
    window.PfShell?.renderShell("dashboard");
    wireDialogs();
    window.PfInstall?.init?.({
      button: document.getElementById("btn-install"),
      dialog: document.getElementById("install-dialog"),
      closeBtn: document.getElementById("install-close"),
      status: setBanner,
    });
    window.UiSelect?.initAll();
    await loadDashboard();
  });
})();
