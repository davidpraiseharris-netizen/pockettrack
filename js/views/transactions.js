/* PocketTrack Transactions view: search, filters, grouped list, edit, delete. */
(function () {
  "use strict";

  const state = { q: "", filter: "all", confirmId: null };
  let unsubscribe = null;

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

  const ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

  function iso(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function dayLabel(s) {
    const p = String(s || "").split("-");
    if (p.length !== 3) return "Unknown date";
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const now = new Date();
    const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (s === iso(now)) return "Today";
    if (s === iso(yest)) return "Yesterday";
    const opts = { weekday: "short", month: "short", day: "numeric" };
    if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
    return d.toLocaleDateString(undefined, opts);
  }

  // Same ranking as the Dashboard so category colors match everywhere
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

  function matches(t, q) {
    if (!q) return true;
    const hay = [t.note, t.category, (amt(t) / 100).toFixed(2), money(amt(t))]
      .join(" ")
      .toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function passesFilter(t) {
    const f = state.filter;
    if (f === "all") return true;
    if (f === "income" || f === "expense") return t.type === f;
    if (f.indexOf("cat:") === 0) return (t.category || "Other") === f.slice(4);
    return true;
  }

  /* ---------- paint ---------- */
  function chipsHTML(all) {
    const cats = [];
    all.forEach((t) => {
      const c = t.category || "Other";
      if (cats.indexOf(c) === -1) cats.push(c);
    });
    cats.sort();

    const chips = [
      { id: "all", label: "All" },
      { id: "income", label: "Income" },
      { id: "expense", label: "Expenses" },
    ].concat(cats.map((c) => ({ id: "cat:" + c, label: c })));

    // If the active category vanished (all its transactions were deleted), reset
    if (!chips.some((c) => c.id === state.filter)) state.filter = "all";

    return chips
      .map(
        (c) =>
          '<button type="button" class="tx-chip' +
          (c.id === state.filter ? " is-active" : "") +
          '" data-filter="' +
          esc(c.id) +
          '">' +
          esc(c.label) +
          "</button>"
      )
      .join("");
  }

  function rowHTML(t, colors) {
    const cat = t.category || "Other";
    const isInc = t.type === "income";
    const confirming = state.confirmId === t.id;

    const actions = confirming
      ? '<div class="tx-actions"><button type="button" class="tx-btn is-confirm" data-confirm="' +
        esc(t.id) +
        '">Delete?</button></div>'
      : '<div class="tx-actions">' +
        '<button type="button" class="tx-btn" data-edit="' +
        esc(t.id) +
        '" aria-label="Edit">' +
        ICON_EDIT +
        "</button>" +
        '<button type="button" class="tx-btn is-danger" data-del="' +
        esc(t.id) +
        '" aria-label="Delete">' +
        ICON_TRASH +
        "</button></div>";

    return (
      '<li class="tx-row"><span class="tx-dot" style="background:' +
      (colors[cat] || "var(--cat-8)") +
      '">' +
      esc(cat.charAt(0).toUpperCase()) +
      '</span><div class="tx-main"><p class="tx-title">' +
      esc(t.note ? t.note : cat) +
      '</p><p class="tx-meta">' +
      esc(cat) +
      '</p></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' +
      '<span class="tx-amt ' +
      (isInc ? "is-income" : "is-expense") +
      '">' +
      (isInc ? "+" : "-") +
      esc(money(amt(t))) +
      "</span>" +
      actions +
      "</div></li>"
    );
  }

  function paint(el) {
    const all = PT.store.list("transactions") || [];
    const colors = buildColorMap(all);
    const q = state.q.trim().toLowerCase();

    const chipsEl = el.querySelector("#tx-chips");
    const sumEl = el.querySelector("#tx-sum");
    const bodyEl = el.querySelector("#tx-body");

    chipsEl.innerHTML = chipsHTML(all);

    const shown = all
      .filter((t) => passesFilter(t) && matches(t, q))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

    if (!all.length) {
      sumEl.innerHTML = "";
      bodyEl.innerHTML =
        '<div class="tx-empty">No transactions yet.<br>Tap the + button to add your first one 💸</div>';
      return;
    }

    if (!shown.length) {
      sumEl.innerHTML = "";
      bodyEl.innerHTML = '<div class="tx-empty">Nothing matches. Try another search or filter 🔍</div>';
      return;
    }

    const net = shown.reduce((n, t) => n + (t.type === "income" ? amt(t) : -amt(t)), 0);
    sumEl.innerHTML =
      "<span>" +
      shown.length +
      (shown.length === 1 ? " transaction" : " transactions") +
      "</span><span>Net " +
      (net < 0 ? "-" : "") +
      esc(money(Math.abs(net))) +
      "</span>";

    // Group by date (already sorted newest first)
    const groups = [];
    shown.forEach((t) => {
      const last = groups[groups.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else groups.push({ date: t.date, items: [t] });
    });

    bodyEl.innerHTML = groups
      .map(
        (g) =>
          '<h3 class="tx-group-title">' +
          esc(dayLabel(g.date)) +
          '</h3><ul class="tx-list">' +
          g.items.map((t) => rowHTML(t, colors)).join("") +
          "</ul>"
      )
      .join("");
  }

  /* ---------- view ---------- */
  PT.views = PT.views || {};
  PT.views.transactions = {
    title: "Transactions",
    selfUpdating: true,

    render(el) {
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;

      state.q = "";
      state.filter = "all";
      state.confirmId = null;

      el.innerHTML =
        '<div class="tx">' +
        '<div class="tx-search"><input id="tx-q" type="search" placeholder="Search transactions" aria-label="Search transactions" autocomplete="off"></div>' +
        '<div class="tx-filters" id="tx-chips"></div>' +
        '<div class="tx-summary" id="tx-sum"></div>' +
        '<div id="tx-body"></div>' +
        "</div>";

      paint(el);

      el.querySelector("#tx-q").addEventListener("input", function (e) {
        state.q = e.target.value;
        state.confirmId = null;
        paint(el);
      });

      el.onclick = function (e) {
        const chip = e.target.closest("[data-filter]");
        if (chip) {
          state.filter = chip.getAttribute("data-filter");
          state.confirmId = null;
          paint(el);
          return;
        }

        const editBtn = e.target.closest("[data-edit]");
        if (editBtn) {
          const id = editBtn.getAttribute("data-edit");
          const tx = (PT.store.list("transactions") || []).find((t) => t.id === id);
          if (tx && PT.addForm) PT.addForm.open(tx);
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
          PT.store.remove("transactions", confirmBtn.getAttribute("data-confirm"));
          if (PT.ui && PT.ui.toast) PT.ui.toast("Transaction deleted");
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