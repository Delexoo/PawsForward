/**
 * Custom dropdown over a native <select>.
 */
(function () {
  const CHEV =
    '<svg class="ui-select-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function optionLabel(opt) {
    return (opt && (opt.textContent || opt.label || opt.value)) || "";
  }

  function enhance(root) {
    if (!root) return;
    const select = root.querySelector("select.ui-select-native, select");
    if (!select) return;

    if (root.dataset.uiSelectReady === "1") {
      if (typeof root._uiSelectRefresh === "function") root._uiSelectRefresh();
      return;
    }

    root.dataset.uiSelectReady = "1";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ui-select-trigger";
    trigger.innerHTML = `<span class="ui-select-label"></span>${CHEV}`;
    const labelEl = trigger.querySelector(".ui-select-label");

    const menu = document.createElement("div");
    menu.className = "ui-select-menu";
    menu.setAttribute("role", "listbox");

    root.appendChild(trigger);
    root.appendChild(menu);

    function syncFromSelect() {
      const opts = Array.from(select.options);
      menu.innerHTML = "";
      opts.forEach((opt, i) => {
        if (opt.disabled && !opt.value) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ui-select-option";
        btn.setAttribute("role", "option");
        btn.dataset.value = opt.value;
        btn.textContent = optionLabel(opt);
        if (opt.selected) btn.classList.add("is-active");
        if (opt.disabled) {
          btn.classList.add("is-disabled");
          btn.disabled = true;
        }
        btn.addEventListener("click", () => {
          select.selectedIndex = i;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          close();
          syncLabel();
          syncActive();
        });
        menu.appendChild(btn);
      });
      syncLabel();
      syncActive();
    }

    function syncLabel() {
      const opt = select.options[select.selectedIndex];
      const empty = !opt || !opt.value;
      labelEl.textContent = empty
        ? select.getAttribute("data-placeholder") || "Select…"
        : optionLabel(opt);
      trigger.classList.toggle("is-placeholder", empty);
    }

    function syncActive() {
      const val = select.value;
      menu.querySelectorAll(".ui-select-option").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.value === val);
      });
    }

    function open() {
      document.querySelectorAll(".ui-select.is-open").forEach((el) => {
        if (el !== root) el.classList.remove("is-open");
      });
      root.classList.add("is-open");
    }

    function close() {
      root.classList.remove("is-open");
    }

    trigger.addEventListener("click", () => {
      if (select.disabled) return;
      root.classList.contains("is-open") ? close() : open();
    });

    select.addEventListener("change", () => {
      syncLabel();
      syncActive();
    });

    syncFromSelect();

    root._uiSelectRefresh = syncFromSelect;
  }

  function initAll(scope) {
    (scope || document).querySelectorAll("[data-ui-select]").forEach(enhance);
  }

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".ui-select.is-open").forEach((el) => {
      if (!el.contains(e.target)) el.classList.remove("is-open");
    });
  });

  document.addEventListener("DOMContentLoaded", () => initAll());
  window.UiSelect = { initAll, enhance };
})();
