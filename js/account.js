(function () {
  "use strict";

  const PAY_LABELS = {
    cashapp: "Cash App",
    venmo: "Venmo",
    paypal: "PayPal",
    zelle: "Zelle",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    chime: "Chime",
    cash: "Cash",
    bank_transfer: "Bank transfer",
    wise: "Wise",
    stripe: "Stripe",
    square: "Square",
    other: "Other",
  };

  const root = document.getElementById("account-root");
  const banner = document.getElementById("status-banner");

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
  }

  function rate() {
    const n = Number(window.SITE_CONFIG?.commissionRate);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.5;
  }

  function setBanner(msg, kind) {
    if (!banner) return;
    banner.hidden = !msg;
    banner.textContent = msg || "";
    banner.classList.toggle("is-ok", kind === "ok");
    banner.classList.toggle("is-err", kind === "err");
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function totals(rows, donations, payouts) {
    const ids = new Set(rows.map((row) => row.id));
    const raised = donations.filter((row) => ids.has(row.employee_id)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paid = payouts.filter((row) => ids.has(row.employee_id)).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const earned = raised * rate();
    return { raised, earned, paid, owed: Math.max(0, earned - paid) };
  }

  function paymentOptions(current) {
    const values = Object.keys(PAY_LABELS);
    if (current && !values.includes(current)) values.unshift(current);
    return values;
  }

  function render(rows, donations, payouts, visits) {
    if (!root) return;
    root.replaceChildren();
    const share = rate();
    const summary = totals(rows, donations, payouts);
    const intro = el("section", "account-intro");
    const name = String(rows[0]?.first_name || "").trim();
    intro.append(
      el("h1", "", name ? `Hi, ${name}.` : "Your dashboard"),
      el("p", "", "This is the balance from gifts shared through your QR. You can change how you get paid at any time.")
    );
    root.append(intro);

    const stats = el("section", "account-stats");
    stats.setAttribute("aria-label", "Your balance");
    [
      ["Raised", summary.raised],
      ["Your share", summary.earned],
      ["Paid out", summary.paid],
      ["Balance", summary.owed],
    ].forEach(([label, value]) => {
      const card = el("article", "account-stat");
      card.append(el("span", "", label), el("strong", "", money(value)));
      stats.append(card);
    });
    root.append(stats);

    rows.forEach((row) => {
      const mineDonations = donations.filter((item) => item.employee_id === row.id);
      const minePaid = payouts.filter((item) => item.employee_id === row.id).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const mineRaised = mineDonations.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const mineVisits = visits.filter((item) => item.employee_id === row.id).length;
      const card = el("section", "join-panel account-card");
      card.append(el("h2", "", "Your QR"));
      const meta = el("p", "account-meta");
      meta.append(el("span", "", row.referral_code || "—"));
      meta.append(document.createTextNode(` · ${mineVisits} visits · owed ${money(Math.max(0, mineRaised * share - minePaid))}`));
      card.append(meta);

      const form = document.createElement("form");
      form.className = "join-form";
      form.action = "#";
      const typeField = el("div", "field");
      const typeLabel = el("label", "", "How you get paid");
      const typeId = `pay-type-${row.id}`;
      typeLabel.htmlFor = typeId;
      const select = document.createElement("select");
      select.id = typeId;
      select.name = "payment_type";
      paymentOptions(row.payment_type).forEach((value) => {
        const option = el("option", "", PAY_LABELS[value] || value);
        option.value = value;
        if (value === row.payment_type) option.selected = true;
        select.append(option);
      });
      typeField.append(typeLabel, select);

      const handleField = el("div", "field");
      const handleLabel = el("label", "", "Payout handle");
      const handleId = `pay-handle-${row.id}`;
      handleLabel.htmlFor = handleId;
      const handle = document.createElement("input");
      handle.id = handleId;
      handle.name = "payment_handle";
      handle.type = "text";
      handle.maxLength = 80;
      handle.required = true;
      handle.value = row.payment_handle || "";
      handle.autocomplete = "off";
      const handleErr = el("p", "field-error", "");
      handleErr.hidden = true;
      handleField.append(handleLabel, handle, handleErr);

      const save = el("button", "join-submit", "Save payout method");
      save.type = "submit";
      form.append(typeField, handleField, save);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const paymentType = select.value;
        const paymentHandle = handle.value.trim();
        handleErr.hidden = true;
        if (!paymentHandle || paymentHandle.length > 80) {
          handleErr.hidden = false;
          handleErr.textContent = "Enter the handle, email, or number where you get paid.";
          return;
        }
        save.disabled = true;
        const sb = window.PfPromoter.getClient();
        const { error } = await sb.from("employees").update({
          payment_type: paymentType,
          payment_handle: paymentHandle,
        }).eq("id", row.id);
        save.disabled = false;
        if (error) {
          setBanner(error.message || "Could not save your payout method.", "err");
          return;
        }
        row.payment_type = paymentType;
        row.payment_handle = paymentHandle;
        setBanner("Payout method saved.", "ok");
      });
      card.append(form);
      root.append(card);
    });

    const gifts = el("section", "join-panel account-card");
    gifts.append(el("h2", "", "Recent gifts"));
    const recent = donations.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8);
    if (!recent.length) {
      gifts.append(el("p", "account-meta", "No gifts yet. Share your QR and they’ll show up here."));
    } else {
      const list = el("ul", "account-gifts");
      recent.forEach((gift) => {
        const item = el("li", "");
        const when = gift.created_at ? new Date(gift.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
        item.append(el("span", "", gift.donor_label || "Gift"), el("strong", "", `${money(gift.amount)} · ${when}`));
        list.append(item);
      });
      gifts.append(list);
    }
    root.append(gifts);
  }

  async function load() {
    const finished = await window.PfPromoter?.finishLink?.();
    const sb = window.PfPromoter?.getClient?.();
    if (!sb) {
      setBanner("Your dashboard is not configured right now.", "err");
      return;
    }
    if (finished && !finished.skipped && !finished.ok) {
      location.replace("/signin");
      return;
    }
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      location.replace("/signin");
      return;
    }
    await sb.rpc("claim_promoter_profile");
    const { data: rows, error } = await sb
      .from("employees")
      .select("id, first_name, email, referral_code, payment_type, payment_handle, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setBanner(error.message || "Could not load your dashboard.", "err");
      return;
    }
    if (!rows?.length) {
      if (root) {
        root.replaceChildren();
        const empty = el("section", "join-panel account-card");
        empty.append(
          el("h1", "", "No QR on this account yet."),
          el("p", "", "Create a QR with this email, then come back."),
          Object.assign(el("a", "join-submit account-link", "Get your QR"), { href: "/join" })
        );
        root.append(empty);
      }
      return;
    }
    const ids = rows.map((row) => row.id);
    const [donationsRes, payoutsRes, visitsRes] = await Promise.all([
      sb.from("donations").select("id, employee_id, amount, donor_label, created_at").in("employee_id", ids),
      sb.from("payouts").select("id, employee_id, amount, created_at").in("employee_id", ids),
      sb.from("visits").select("id, employee_id").in("employee_id", ids),
    ]);
    if (donationsRes.error || payoutsRes.error || visitsRes.error) {
      setBanner("Some of your totals couldn’t be loaded.", "err");
    }
    render(rows, donationsRes.data || [], payoutsRes.data || [], visitsRes.data || []);
  }

  document.getElementById("account-signout")?.addEventListener("click", async () => {
    await window.PfPromoter?.signOut?.();
    location.replace("/signin");
  });

  document.addEventListener("DOMContentLoaded", () => {
    void load();
  });
})();
