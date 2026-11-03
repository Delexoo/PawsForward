(function () {
  const COMMISSION = () => Number(window.SITE_CONFIG?.commissionRate ?? 0.25);

  const els = {
    banner: document.getElementById("status-banner"),
    totalDonors: document.getElementById("stat-total-donors"),
    donors24h: document.getElementById("stat-donors-24h"),
    totalDonated: document.getElementById("stat-total-donated"),
    totalOwed: document.getElementById("stat-total-owed"),
    totalVisits: document.getElementById("stat-total-visits"),
    employeesBody: document.getElementById("employees-body"),
    employeesEmpty: document.getElementById("employees-empty"),
    donationsFeed: document.getElementById("donations-feed"),
    donationsEmpty: document.getElementById("donations-empty"),
    geoList: document.getElementById("geo-list"),
    geoEmpty: document.getElementById("geo-empty"),
    employeeDialog: document.getElementById("employee-dialog"),
    employeeForm: document.getElementById("employee-form"),
    employeeCancel: document.getElementById("employee-cancel"),
    employeeSubmit: document.getElementById("employee-submit"),
    btnNew: document.getElementById("btn-new-employee"),
    qrDialog: document.getElementById("qr-dialog"),
    qrLead: document.getElementById("qr-dialog-lead"),
    qrHost: document.getElementById("qr-canvas-host"),
    qrLinkText: document.getElementById("qr-link-text"),
    qrCopy: document.getElementById("qr-copy-link"),
    qrDownload: document.getElementById("qr-download"),
    qrClose: document.getElementById("qr-close"),
    menuBtn: document.getElementById("menu-btn"),
    overlay: document.getElementById("sidebar-overlay"),
  };

  let currentQr = { url: "", name: "" };

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

  function donateUrl(code) {
    const u = new URL("donate.html", window.location.href);
    if (code) u.searchParams.set("code", code);
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
    if (crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    }
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
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  async function openQrDialog(employee) {
    const url = donateUrl(employee.referral_code);
    currentQr = {
      url,
      name: `${employee.first_name}-${employee.last_name}`.replace(/\s+/g, "-"),
    };
    els.qrLead.textContent = `QR for ${employee.first_name} ${employee.last_name}. Donations through this link count toward their payout (25%).`;
    els.qrLinkText.textContent = url;
    els.qrHost.innerHTML = "";
    try {
      const canvas = await window.PfQr.toCanvas(url, 220);
      els.qrHost.appendChild(canvas);
    } catch (err) {
      els.qrHost.textContent = "Could not render QR.";
      console.error(err);
    }
    els.qrDialog.showModal();
  }

  function renderEmployees(employees, donationStats) {
    const body = els.employeesBody;
    body.innerHTML = "";
    if (!employees.length) {
      els.employeesEmpty.hidden = false;
      return;
    }
    els.employeesEmpty.hidden = true;

    employees.forEach((emp) => {
      const stats = donationStats[emp.id] || { count: 0, raised: 0 };
      const owed = stats.raised * COMMISSION();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong></td>
        <td>${escapeHtml(emp.phone)}</td>
        <td><span class="badge">${escapeHtml(paymentLabel(emp.payment_type))}</span></td>
        <td>${stats.count}</td>
        <td class="money">${money(stats.raised)}</td>
        <td class="money">${money(owed)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn secondary btn-sm" data-action="view-qr">View QR</button>
            <button type="button" class="btn secondary btn-sm" data-action="copy-link">Copy link</button>
          </div>
        </td>
      `;
      tr.querySelector('[data-action="view-qr"]').addEventListener("click", () => openQrDialog(emp));
      tr.querySelector('[data-action="copy-link"]').addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(donateUrl(emp.referral_code));
          setBanner(`Copied donate link for ${emp.first_name}.`, "ok");
        } catch {
          setBanner("Could not copy link.", "err");
        }
      });
      body.appendChild(tr);
    });
  }

  function renderDonations(rows, employeeMap) {
    const feed = els.donationsFeed;
    feed.innerHTML = "";
    if (!rows.length) {
      els.donationsEmpty.hidden = false;
      return;
    }
    els.donationsEmpty.hidden = true;
    rows.slice(0, 12).forEach((d) => {
      const emp = d.employee_id ? employeeMap[d.employee_id] : null;
      const who = emp
        ? `${emp.first_name} ${emp.last_name}`
        : d.referral_code
          ? `code ${d.referral_code}`
          : "General";
      const donor = d.donor_label || "Anonymous";
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>${escapeHtml(donor)}</strong>
          <div class="feed-meta">${escapeHtml(who)} · ${relativeTime(d.created_at)}</div>
        </div>
        <span class="feed-amount">${money(d.amount)}</span>
      `;
      feed.appendChild(li);
    });
  }

  function renderGeo(visits) {
    const counts = new Map();
    visits.forEach((v) => {
      const parts = [v.city, v.region, v.country].filter(Boolean);
      const key = parts.length ? parts.join(", ") : "Unknown";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    els.geoList.innerHTML = "";
    if (!ranked.length) {
      els.geoEmpty.hidden = false;
      return;
    }
    els.geoEmpty.hidden = true;
    const max = ranked[0][1] || 1;
    ranked.forEach(([label, count]) => {
      const row = document.createElement("div");
      row.className = "geo-bar-row";
      const pct = Math.max(8, Math.round((count / max) * 100));
      row.innerHTML = `
        <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
        <div class="geo-bar-track"><div class="geo-bar-fill" style="width:${pct}%"></div></div>
        <span class="geo-count">${count}</span>
      `;
      els.geoList.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadDashboard() {
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Add your Supabase URL and anon key in js/config.js (see .env.example).", "err");
      return;
    }

    setBanner("Loading…");

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [empRes, donRes, visitRes, don24Res] = await Promise.all([
      sb.from("employees").select("*").order("created_at", { ascending: false }),
      sb.from("donations").select("*").order("created_at", { ascending: false }).limit(200),
      sb.from("visits").select("city,region,country,created_at").order("created_at", { ascending: false }).limit(1000),
      sb.from("donations").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    ]);

    if (empRes.error || donRes.error || visitRes.error) {
      const err = empRes.error || donRes.error || visitRes.error;
      setBanner(err.message || "Failed to load data.", "err");
      console.error(empRes.error, donRes.error, visitRes.error);
      return;
    }

    const employees = empRes.data || [];
    const donations = donRes.data || [];
    const visits = visitRes.data || [];

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

    els.totalDonors.textContent = String(donations.length);
    els.donors24h.textContent = String(don24Res.count ?? 0);
    els.totalDonated.textContent = money(raisedTotal);
    els.totalOwed.textContent = money(attributedRaised * COMMISSION());
    els.totalVisits.textContent = String(visits.length);

    const employeeMap = Object.fromEntries(employees.map((e) => [e.id, e]));
    renderEmployees(employees, donationStats);
    renderDonations(donations, employeeMap);
    renderGeo(visits);
    setBanner("", null);
  }

  async function createEmployee(e) {
    e.preventDefault();
    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setBanner("Supabase is not configured.", "err");
      return;
    }

    const fd = new FormData(els.employeeForm);
    const payload = {
      first_name: String(fd.get("first_name") || "").trim(),
      last_name: String(fd.get("last_name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      payment_type: String(fd.get("payment_type") || "").trim(),
      referral_code: referralCode(),
    };

    if (!payload.first_name || !payload.last_name || !payload.phone || !payload.payment_type) {
      setBanner("Fill in all employee fields.", "err");
      return;
    }

    els.employeeSubmit.disabled = true;
    const { data, error } = await sb.from("employees").insert(payload).select("*").single();
    els.employeeSubmit.disabled = false;

    if (error) {
      setBanner(error.message || "Could not create employee.", "err");
      return;
    }

    els.employeeDialog.close();
    els.employeeForm.reset();
    window.UiSelect?.initAll(els.employeeForm);
    setBanner(`Created ${data.first_name} ${data.last_name}.`, "ok");
    await loadDashboard();
    await openQrDialog(data);
  }

  function wireShell() {
    els.menuBtn?.addEventListener("click", () => {
      document.body.classList.toggle("sidebar-open");
      if (els.overlay) els.overlay.hidden = !document.body.classList.contains("sidebar-open");
    });
    els.overlay?.addEventListener("click", () => {
      document.body.classList.remove("sidebar-open");
      els.overlay.hidden = true;
    });
  }

  function wireDialogs() {
    els.btnNew?.addEventListener("click", () => {
      els.employeeForm.reset();
      window.UiSelect?.initAll(els.employeeForm);
      els.employeeDialog.showModal();
    });
    els.employeeCancel?.addEventListener("click", () => els.employeeDialog.close());
    els.employeeForm?.addEventListener("submit", createEmployee);

    els.qrClose?.addEventListener("click", () => els.qrDialog.close());
    els.qrCopy?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(currentQr.url);
        setBanner("Donate link copied.", "ok");
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

  document.addEventListener("DOMContentLoaded", () => {
    wireShell();
    wireDialogs();
    window.UiSelect?.initAll();
    loadDashboard();
  });
})();
