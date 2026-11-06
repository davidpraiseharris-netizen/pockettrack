/* PocketTrack Budgets view: monthly limits per expense category, with progress bars. */
(function () {
  "use strict";

  const DEFAULT_EXPENSE_CATS = [
    "Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Education", "Other",
  ];

  const state = { confirmId: null };
  let unsubscribe = null;
  let sheet = null;

  /* ---------- helpers ---------- */
  const esc = (s) => PT.util.escapeHtml(String(s == null ? "" : s));
  const amt = (t) => Math.abs(Number(t.amount) || 0);

  function money(cents) {
    try {
      return PT.util.formatMoney(cents, PT.store.getSettings().currency);
    } catch (e) {
      return (cents / 100).toFixed(2);
    }
  }

  function currencySymbol() {
    try {
      const s = PT.util
        .formatMoney(0, PT.store.getSettings().currency)
        .replace(/[0-9.,\s\u00a0-]/g, "");
      return s || "$";
    } catch (e) {
      return "$";
    }
  }

  function iso(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function monthRange() {
    const now = new Date();
    return [
      iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    ];
  }

  function monthName() {
    return new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  // Same ranking as Dashboard and Transactions so colors match everywhere
  function buildColorMap(all) {
    const totals = {};
    all.forEach((t) => {
      const c = t.category || "Other";
      totals[c] = (totals[c] || 0) + amt(t);
    });
    const names = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const map = {};
    names.forEach((n, i) => {
      map[n] = "var(--cat-" + ((i % 7) + 1) + ")";
    });
    return map;
  }

  const ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

  /* ---------- data ---------- */
  function spentThisMonth() {
    const [from, to] = monthRange();
    const spent = {};
    (PT.store.list("transactions") || []).forEach((t) => {
      if (t.type !== "expense") return;
      if (t.date < from || t.date > to) return;
      const c = t.category || "Other";
      spent[c] = (spent[c] || 0) + amt(t);
    });
    return spent;
  }

  /* ---------- paint ---------- */
  function summaryHTML(budgets, spent) {
    if (!budgets.length) return "";
    const totalLimit = budgets.reduce((n, b) => n + (Number(b.limit) || 0), 0);
    const totalSpent = budgets.reduce((n, b) => n + (spent[b.category] || 0), 0);
    const left = totalLimit - totalSpent;
    const pct = totalLimit ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
    const over = left < 0;

    return (
      '<section class="bd-summary">' +
      '<p class="bd-summary-label">' +
      esc(monthName()) +
      " budget</p>" +
      '<h2 class="bd-summary-amount">' +
      esc(money(Math.abs(left))) +
      (over ? " over" : " left") +
      "</h2>" +
      '<p class="bd-summary-sub">' +
      esc(money(totalSpent)) +
      " spent of " +
      esc(money(totalLimit)) +
      "</p>" +
      '<div class="bd-summary-bar"><div class="bd-summary-fill' +
      (over ? " is-over" : "") +
      '" style="width:' +
      pct.toFixed(1) +
      '%"></div></div>' +
      '<div class="bd-summary-foot"><span>' +
      budgets.length +
      (budgets.length === 1 ? " budget" : " budgets") +
      "</span><span>" +
      Math.round(totalLimit ? (totalSpent / totalLimit) * 100 : 0) +
      "% used</span></div>" +
      "</section>"
    );
  }

  function cardHTML(b, spent, colors) {
    const limit = Number(b.limit) || 0;
    const used = spent[b.category] || 0;
    const ratio = limit ? used / limit : 0;
    const left = limit - used;
    const cls = ratio > 1 ? " is-over" : ratio >= 0.75 ? " is-warn" : "";
    const confirming = state.confirmId === b.id;

    const actions = confirming
      ? '<div class="bd-actions"><button type="button" class="bd-btn is-confirm" data-confirm="' +
        esc(b.id) +
        '">Delete?</button></div>'
      : '<div class="bd-actions">' +
        '<button type="button" class="bd-btn" data-edit="' +
        esc(b.id) +
        '" aria-label="Edit budget">' +
        ICON_EDIT +
        "</button>" +
        '<button type="button" class="bd-btn is-danger" data-del="' +
        esc(b.id) +
        '" aria-label="Delete budget">' +
        ICON_TRASH +
        "</button></div>";

    return (
      '<article class="bd-card' +
      cls +
      '"><div class="bd-card-top"><span class="bd-dot" style="background:' +
      (colors[b.category] || "var(--cat-8)") +
      '">' +
      esc(String(b.category || "?").charAt(0).toUpperCase()) +
      '</span><div class="bd-main"><p class="bd-name">' +
      esc(b.category) +
      '</p><p class="bd-nums"><strong>' +
      esc(money(used)) +
      "</strong> of " +
      esc(money(limit)) +
      "</p></div>" +
      actions +
      '</div><div class="bd-bar"><div class="bd-fill" style="width:' +
      Math.min(ratio * 100, 100).toFixed(1) +
      '%"></div></div><div class="bd-status"><span>' +
      Math.round(ratio * 100) +
      '% used</span><span class="bd-left">' +
      esc(money(Math.abs(left))) +
      (left < 0 ? " over" : " left") +
      "</span></div></article>"
    );
  }

  function paint(el) {
    const budgets = (PT.store.list("budgets") || []).slice().sort((a, b) =>
      String(a.category).localeCompare(String(b.category))
    );
    const spent = spentThisMonth();
    const colors = buildColorMap(PT.store.list("transactions") || []);

    let body;
    if (!budgets.length) {
      body =
        '<div class="bd-empty">No budgets yet.<br>Set a monthly limit for a category and keep your spending in check 🎯</div>';
    } else {
      body =
        '<div class="bd-list">' +
        budgets.map((b) => cardHTML(b, spent, colors)).join("") +
        "</div>";
    }

        el.innerHTML =
      '<div class="bd">' +
      summaryHTML(budgets, spent) +
      '<div class="bd-head"><h3 class="bd-title">Monthly budgets</h3>' +
      '<button type="button" class="bd-add" data-add>+ Add budget</button></div>' +
      body +
      '<div id="bd-goals"></div>' +
      "</div>";

    // Savings goals live under the budgets
    if (PT.savings) PT.savings.mount(el.querySelector("#bd-goals"));
  }
  /* ---------- add / edit sheet ---------- */
  function closeSheet() {
    if (!sheet) return;
    const el = sheet;
    sheet = null;
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    el.classList.remove("is-open");
    setTimeout(function () {
      el.remove();
    }, 250);
  }

  function onKey(e) {
    if (e.key === "Escape") closeSheet();
  }

  function openSheet(budget) {
    if (sheet) return;
    const editing = !!(budget && budget.id);
    const existing = PT.store.list("budgets") || [];
    const taken = existing.map((b) => b.category);

    // Offer default categories plus any expense category the user has actually used
    const options = DEFAULT_EXPENSE_CATS.slice();
    (PT.store.list("transactions") || []).forEach((t) => {
      if (t.type === "expense" && t.category && options.indexOf(t.category) === -1) {
        options.push(t.category);
      }
    });
    const available = options.filter((c) => taken.indexOf(c) === -1);

    let chosen = editing ? budget.category : "";

    sheet = document.createElement("div");
    sheet.className = "sheet-backdrop";
    sheet.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' +
      (editing ? "Edit budget" : "Add budget") +
      '"><div class="sheet-grab"></div>' +
      '<div class="sheet-head"><h2 class="sheet-title">' +
      (editing ? "Edit budget" : "Add budget") +
      '</h2><button type="button" class="sheet-close" data-close aria-label="Close">&times;</button></div>' +
      '<div class="tf">' +
      '<div class="tf-field"><span class="tf-label">Category</span><div class="tf-cats" id="bf-cats"></div></div>' +
      (editing
        ? ""
        : '<div class="tf-field"><label class="tf-label" for="bf-custom">Or type a new category</label>' +
          '<input class="tf-input" id="bf-custom" type="text" maxlength="24" placeholder="e.g. Airtime"></div>') +
      '<div class="tf-field"><span class="tf-label">Monthly limit</span>' +
      '<div class="tf-amount"><span class="tf-amount-sym">' +
      esc(currencySymbol()) +
      '</span><input id="bf-limit" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Monthly limit"></div></div>' +
      '<p class="tf-error" id="bf-error" role="alert"></p>' +
      '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
      '<button type="button" class="tf-save" id="bf-save">' +
      (editing ? "Save changes" : "Save budget") +
      "</button></div></div></div>";

    document.body.appendChild(sheet);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    const $ = (sel) => sheet.querySelector(sel);
    const catsEl = $("#bf-cats");
    const limitEl = $("#bf-limit");
    const errEl = $("#bf-error");
    const customEl = $("#bf-custom");

    if (editing) limitEl.value = (Number(budget.limit) / 100).toFixed(2);

    function paintCats() {
      if (editing) {
        catsEl.innerHTML =
          '<button type="button" class="tf-cat is-active" disabled>' + esc(chosen) + "</button>";
        return;
      }
      if (!available.length) {
        catsEl.innerHTML =
          '<span style="font-size:var(--text-sm);color:var(--charcoal-500)">All categories already have a budget. Type a new one below.</span>';
        return;
      }
      catsEl.innerHTML = available
        .map(function (c) {
          return (
            '<button type="button" class="tf-cat' +
            (c === chosen ? " is-active" : "") +
            '" data-cat="' +
            esc(c) +
            '">' +
            esc(c) +
            "</button>"
          );
        })
        .join("");
    }

    function save() {
      const raw = parseFloat(String(limitEl.value).replace(/,/g, "").trim());
      const cents = isFinite(raw) ? Math.round(raw * 100) : 0;

      let category = chosen;
      if (!editing && customEl && customEl.value.trim()) category = customEl.value.trim();

      if (!category) {
        errEl.textContent = "Pick a category or type a new one.";
        return;
      }
      if (cents <= 0) {
        errEl.textContent = "Enter a limit greater than 0.";
        limitEl.focus();
        return;
      }
      if (!editing) {
        const dupe = taken.some((c) => String(c).toLowerCase() === category.toLowerCase());
        if (dupe) {
          errEl.textContent = "You already have a budget for " + category + ".";
          return;
        }
      }

      if (editing) {
        PT.store.update("budgets", budget.id, { limit: cents });
      } else {
        PT.store.add("budgets", { category: category, limit: cents, createdAt: Date.now() });
      }

      closeSheet();
      if (PT.ui && PT.ui.toast) PT.ui.toast(editing ? "Budget updated" : "Budget added");
    }

    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) {
        closeSheet();
        return;
      }
      const catBtn = e.target.closest("[data-cat]");
      if (catBtn) {
        chosen = catBtn.getAttribute("data-cat");
        if (customEl) customEl.value = "";
        errEl.textContent = "";
        paintCats();
        return;
      }
      if (e.target.closest("#bf-save")) save();
    });

    limitEl.addEventListener("input", function () {
      errEl.textContent = "";
      limitEl.value = limitEl.value.replace(/[^0-9.,]/g, "");
    });
    limitEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") save();
    });
    if (customEl) {
      customEl.addEventListener("input", function () {
        if (customEl.value.trim()) {
          chosen = "";
          paintCats();
        }
        errEl.textContent = "";
      });
    }

    paintCats();
    requestAnimationFrame(function () {
      sheet.classList.add("is-open");
    });
  }

  /* ---------- view ---------- */
  PT.views = PT.views || {};
  PT.views.budgets = {
    title: "Budgets",
    selfUpdating: true,

    render(el) {
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;
      state.confirmId = null;

      paint(el);

      el.onclick = function (e) {
        if (e.target.closest("[data-add]")) {
          openSheet();
          return;
        }

        const editBtn = e.target.closest("[data-edit]");
        if (editBtn) {
          const id = editBtn.getAttribute("data-edit");
          const b = (PT.store.list("budgets") || []).find((x) => x.id === id);
          if (b) openSheet(b);
          return;
        }

        const delBtn = e.target.closest("[data-del]");
        if (delBtn) {
          state.confirmId = delBtn.getAttribute("data-del");
          paint(el);
          return;
        }

        const confirmBtn = e.target.closest("[data-confirm]");
        if (confirmBtn) {
          state.confirmId = null;
          PT.store.remove("budgets", confirmBtn.getAttribute("data-confirm"));
          if (PT.ui && PT.ui.toast) PT.ui.toast("Budget deleted");
          return;
        }

        // Tapped anywhere else: cancel a pending delete
        if (state.confirmId) {
          state.confirmId = null;
          paint(el);
        }
      };

      const off = PT.store.subscribe(function () {
        if (!el.isConnected) {
          if (typeof off === "function") off();
          return;
        }
        paint(el);
      });
      unsubscribe = off;
    },
  };
})();