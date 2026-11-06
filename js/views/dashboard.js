/* PocketTrack Dashboard view. Real data from PT.store. */
(function () {
  "use strict";

  const PERIODS = [
    { id: "today", label: "Today", title: "Today" },
    { id: "week", label: "Week", title: "This week" },
    { id: "month", label: "Month", title: "This month" },
    { id: "year", label: "Year", title: "This year" },
  ];

  let period = "month";
  let unsubscribe = null;

  /* ---------- helpers ---------- */
  const esc = (s) => PT.util.escapeHtml(String(s == null ? "" : s));

  function money(cents) {
    try {
      const cur = PT.store.getSettings().currency;
      return PT.util.formatMoney(cents, cur);
    } catch (e) {
      return (cents / 100).toFixed(2);
    }
  }

  function icon(name) {
    try {
      return PT.icons.get(name) || "";
    } catch (e) {
      return "";
    }
  }

  function iso(d) {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  // Returns [startISO, endISO] inclusive for the chosen period
  function range(id) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    if (id === "today") return [iso(now), iso(now)];
    if (id === "week") {
      const mondayOffset = (now.getDay() + 6) % 7;
      const start = new Date(y, m, now.getDate() - mondayOffset);
      const end = new Date(y, m, now.getDate() - mondayOffset + 6);
      return [iso(start), iso(end)];
    }
    if (id === "year") return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
  }

  function shortDate(s) {
    const p = String(s || "").split("-");
    if (p.length !== 3) return "";
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  const amt = (t) => Math.abs(Number(t.amount) || 0);

  function sumBy(list, type) {
    return list.reduce((n, t) => (t.type === type ? n + amt(t) : n), 0);
  }

  // Stable category colors: ranked by total money across all transactions
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

  /* ---------- sections ---------- */
  function filtersHTML() {
    return (
      '<div class="db-filters" role="tablist" aria-label="Time period">' +
      PERIODS.map(
        (p) =>
          '<button class="db-filter' +
          (p.id === period ? " is-active" : "") +
          '" role="tab" aria-selected="' +
          (p.id === period) +
          '" data-period="' +
          p.id +
          '">' +
          p.label +
          "</button>"
      ).join("") +
      "</div>"
    );
  }

  function balanceHTML(all) {
    const bal = sumBy(all, "income") - sumBy(all, "expense");
    return (
      '<section class="db-balance">' +
      '<p class="db-balance-label">Total balance</p>' +
      '<h2 class="db-balance-amount">' +
      esc(money(bal)) +
      "</h2>" +
      '<p class="db-balance-sub">All income minus all expenses</p>' +
      "</section>"
    );
  }

  function statsHTML(inPeriod) {
    const inc = sumBy(inPeriod, "income");
    const exp = sumBy(inPeriod, "expense");
    const net = inc - exp;
    return (
      '<section class="db-stats">' +
      '<div class="db-stat is-income"><div class="db-stat-top"><span class="db-stat-icon">' +
      icon("arrow-down") +
      '</span><span class="db-stat-label">Income</span></div><p class="db-stat-value">' +
      esc(money(inc)) +
      "</p></div>" +
      '<div class="db-stat is-expense"><div class="db-stat-top"><span class="db-stat-icon">' +
      icon("arrow-up") +
      '</span><span class="db-stat-label">Expenses</span></div><p class="db-stat-value">' +
      esc(money(exp)) +
      "</p></div>" +
      '<div class="db-stat"><div class="db-stat-top"><span class="db-stat-icon">' +
      icon("wallet") +
      '</span><span class="db-stat-label">Net</span></div><p class="db-stat-value' +
      (net < 0 ? " is-negative" : "") +
      '">' +
      esc(money(net)) +
      "</p></div>" +
      "</section>"
    );
  }

  function donutHTML(inPeriod, colors) {
    const title = PERIODS.find((p) => p.id === period).title;
    const expenses = inPeriod.filter((t) => t.type === "expense");
    const total = expenses.reduce((n, t) => n + amt(t), 0);

    let body;
    if (!total) {
      body =
        '<p style="margin:0;color:var(--charcoal-500);font-size:var(--text-sm);text-align:center;padding:var(--s-4) 0;">No spending ' +
        esc(title.toLowerCase()) +
        " yet. Nice and clean 🌿</p>";
    } else {
      const byCat = {};
      expenses.forEach((t) => {
        const c = t.category || "Other";
        byCat[c] = (byCat[c] || 0) + amt(t);
      });
      let rows = Object.keys(byCat)
        .map((name) => ({ name, value: byCat[name], color: colors[name] || "var(--cat-8)" }))
        .sort((a, b) => b.value - a.value);

      if (rows.length > 5) {
        const rest = rows.slice(5).reduce((n, r) => n + r.value, 0);
        rows = rows.slice(0, 5);
        rows.push({ name: "Other", value: rest, color: "var(--cat-8)" });
      }

      const R = 70;
      const C = 2 * Math.PI * R;
      const gap = rows.length > 1 ? 3 : 0;
      let offset = 0;
      const segs = rows
        .map((r) => {
          const len = (r.value / total) * C;
          const draw = Math.max(len - gap, 0.5);
          const seg =
            '<circle class="db-donut-seg" cx="90" cy="90" r="' +
            R +
            '" fill="none" stroke="' +
            r.color +
            '" stroke-width="22" stroke-dasharray="' +
            draw.toFixed(2) +
            " " +
            (C - draw).toFixed(2) +
            '" stroke-dashoffset="' +
            (-offset).toFixed(2) +
            '"></circle>';
          offset += len;
          return seg;
        })
        .join("");

      const legend = rows
        .map(
          (r) =>
            '<li><span class="db-dot" style="background:' +
            r.color +
            '"></span><span class="db-legend-name">' +
            esc(r.name) +
            '</span><span class="db-legend-pct">' +
            Math.round((r.value / total) * 100) +
            '%</span><span class="db-legend-amt">' +
            esc(money(r.value)) +
            "</span></li>"
        )
        .join("");

      body =
        '<div class="db-donut-wrap"><div class="db-donut">' +
        '<svg viewBox="0 0 180 180" aria-hidden="true"><circle class="db-donut-track" cx="90" cy="90" r="' +
        R +
        '" fill="none" stroke-width="22"></circle>' +
        segs +
        "</svg>" +
        '<div class="db-donut-center"><small>Spent</small><strong>' +
        esc(money(total)) +
        "</strong></div></div>" +
        '<ul class="db-legend">' +
        legend +
        "</ul></div>";
    }

    return (
      '<section class="db-card"><div class="db-card-head"><h3 class="db-card-title">Spending by category</h3></div>' +
      body +
      "</section>"
    );
  }

  function recentHTML(all, colors) {
    const recent = all
      .slice()
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .slice(0, 5);

    let body;
    if (!recent.length) {
      body =
        '<p style="margin:0;color:var(--charcoal-500);font-size:var(--text-sm);text-align:center;padding:var(--s-4) 0;">No transactions yet. Tap the + button to add your first one 💸</p>';
    } else {
      body =
        '<ul class="db-tx-list">' +
        recent
          .map((t) => {
            const cat = t.category || "Other";
            const isInc = t.type === "income";
            const title = t.note ? t.note : cat;
            return (
              '<li class="db-tx"><span class="db-tx-dot" style="background:' +
              (colors[cat] || "var(--cat-8)") +
              '">' +
              esc(cat.charAt(0).toUpperCase()) +
              '</span><div class="db-tx-main"><p class="db-tx-title">' +
              esc(title) +
              '</p><p class="db-tx-meta">' +
              esc(cat) +
              " · " +
              esc(shortDate(t.date)) +
              '</p></div><span class="db-tx-amt ' +
              (isInc ? "is-income" : "is-expense") +
              '">' +
              (isInc ? "+" : "-") +
              esc(money(amt(t))) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>";
    }

    return (
      '<section class="db-card"><div class="db-card-head"><h3 class="db-card-title">Recent transactions</h3><a class="db-link" href="#/transactions">See all</a></div>' +
      body +
      "</section>"
    );
  }

  /* ---------- view ---------- */
  function draw(el) {
    const all = PT.store.list("transactions") || [];
    const [from, to] = range(period);
    const inPeriod = all.filter((t) => t.date >= from && t.date <= to);
    const colors = buildColorMap(all);

    el.innerHTML =
      '<div class="db">' +
      filtersHTML() +
      balanceHTML(all) +
      statsHTML(inPeriod) +
      '<div class="db-grid">' +
      donutHTML(inPeriod, colors) +
      recentHTML(all, colors) +
      "</div></div>";
  }

  PT.views = PT.views || {};
  PT.views.dashboard = {
    title: "Dashboard",
    selfUpdating: true,

    render(el) {
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;

      draw(el);

      el.onclick = function (e) {
        const btn = e.target.closest("[data-period]");
        if (!btn) return;
        period = btn.getAttribute("data-period");
        draw(el);
      };

      const off = PT.store.subscribe(function () {
        if (!el.isConnected) {
          if (typeof off === "function") off();
          return;
        }
        draw(el);
      });
      unsubscribe = off;
    },
  };
})();