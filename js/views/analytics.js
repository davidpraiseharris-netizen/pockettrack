/* PocketTrack Analytics: insights, 6-month bars, spending trend, top categories. Plain SVG. */
(function () {
  "use strict";

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

  function iso(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  const monthKey = (d) => iso(d).slice(0, 7);

  function niceMax(v) {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function fmtAxis(cents) {
    const v = cents / 100;
    const trim = (x) => Number(x.toFixed(1)).toString();
    if (v >= 1e6) return trim(v / 1e6) + "M";
    if (v >= 1000) return trim(v / 1000) + "k";
    return trim(v);
  }

  // Same ranking as the other screens so category colors match everywhere
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

  /* ---------- data ---------- */
  function compute(all) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const curKey = monthKey(now);
    const prevDate = new Date(y, m - 1, 1);
    const prevKey = monthKey(prevDate);
    const prevDays = new Date(y, m, 0).getDate();
    const cutoff = Math.min(today, prevDays);

    // Last 6 months, oldest first
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - i, 1);
      months.push({
        key: monthKey(d),
        label: d.toLocaleDateString(undefined, { month: "short" }),
        income: 0,
        expense: 0,
      });
    }
    const byKey = {};
    months.forEach((mo) => (byKey[mo.key] = mo));

    const catTotals = {};
    const daily = new Array(daysInMonth).fill(0);
    let curIncome = 0;
    let curExpense = 0;
    let prevExpenseToDate = 0;

    all.forEach((t) => {
      const key = String(t.date || "").slice(0, 7);
      const mo = byKey[key];
      if (mo) {
        if (t.type === "income") mo.income += amt(t);
        else if (t.type === "expense") mo.expense += amt(t);
      }

      if (key === curKey) {
        if (t.type === "income") curIncome += amt(t);
        if (t.type === "expense") {
          curExpense += amt(t);
          const c = t.category || "Other";
          catTotals[c] = (catTotals[c] || 0) + amt(t);
          const day = parseInt(String(t.date).slice(8, 10), 10);
          if (day >= 1 && day <= daysInMonth) daily[day - 1] += amt(t);
        }
      }

      if (key === prevKey && t.type === "expense") {
        const day = parseInt(String(t.date).slice(8, 10), 10);
        if (day <= cutoff) prevExpenseToDate += amt(t);
      }
    });

    const cats = Object.keys(catTotals)
      .map((name) => ({ name: name, value: catTotals[name] }))
      .sort((a, b) => b.value - a.value);

    return {
      months, cats, daily, today, daysInMonth,
      curIncome, curExpense, prevExpenseToDate,
    };
  }

  /* ---------- insights ---------- */
  function insightHTML(cls, emoji, label, text) {
    return (
      '<div class="an-insight' + (cls ? " " + cls : "") + '">' +
      '<span class="an-insight-emoji">' + emoji + "</span><div>" +
      '<p class="an-insight-label">' + esc(label) + "</p>" +
      '<p class="an-insight-text">' + text + "</p></div></div>"
    );
  }

  function insightsHTML(d) {
    // 1. Spending vs the same point last month
    let a;
    if (!d.curExpense && !d.prevExpenseToDate) {
      a = insightHTML("", "🌿", "Vs last month", "No spending yet. Nice and clean.");
    } else if (!d.prevExpenseToDate) {
      a = insightHTML("", "👀", "Vs last month",
        "You've spent " + esc(money(d.curExpense)) + " so far. Nothing from last month to compare yet.");
    } else {
      const pct = Math.round(((d.curExpense - d.prevExpenseToDate) / d.prevExpenseToDate) * 100);
      if (pct < 0) {
        a = insightHTML("", "📉", "Vs last month",
          "You're spending " + Math.abs(pct) + "% less than this point last month. Keep it up!");
      } else if (pct === 0) {
        a = insightHTML("", "⚖️", "Vs last month", "Right on pace with last month.");
      } else {
        a = insightHTML(pct >= 25 ? "is-bad" : "is-warn", "📈", "Vs last month",
          "You're spending " + pct + "% more than this point last month.");
      }
    }

    // 2. Biggest category
    let b;
    if (!d.cats.length) {
      b = insightHTML("", "🏆", "Top category", "No spending categories yet this month.");
    } else {
      const top = d.cats[0];
      const share = Math.round((top.value / d.curExpense) * 100);
      b = insightHTML("", "🏆", "Top category",
        "<strong>" + esc(top.name) + "</strong> is your biggest spend: " +
        esc(money(top.value)) + " (" + share + "% of this month).");
    }

    // 3. Savings rate
    let c;
    if (!d.curIncome) {
      c = insightHTML("", "💰", "Savings rate", "Add income this month to see your savings rate.");
    } else {
      const rate = Math.round(((d.curIncome - d.curExpense) / d.curIncome) * 100);
      if (rate < 0) {
        c = insightHTML("is-bad", "⚠️", "Savings rate",
          "You've spent " + Math.abs(rate) + "% more than you earned this month.");
      } else if (rate < 20) {
        c = insightHTML("is-warn", "💰", "Savings rate",
          "You're saving " + rate + "% of this month's income.");
      } else {
        c = insightHTML("", "🚀", "Savings rate",
          "You're saving " + rate + "% of this month's income. Strong!");
      }
    }

    return '<section class="an-insights">' + a + b + c + "</section>";
  }

  /* ---------- income vs expenses bars ---------- */
  function barsHTML(d) {
    const hasData = d.months.some((mo) => mo.income || mo.expense);
    let body;

    if (!hasData) {
      body = '<div class="an-empty">Add some transactions and your trends will show up here 📊</div>';
    } else {
      const W = 360, H = 200, L = 40, R = 8, T = 10, B = 26;
      const plotW = W - L - R;
      const plotH = H - T - B;
      const max = niceMax(Math.max.apply(null, d.months.map((mo) => Math.max(mo.income, mo.expense))));
      const gw = plotW / d.months.length;
      const barW = Math.min(16, gw / 3);
      const gap = 4;

      let grid = "";
      for (let i = 0; i <= 4; i++) {
        const y = T + plotH - (i / 4) * plotH;
        grid +=
          '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"></line>' +
          '<text class="an-axis" x="' + (L - 6) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' +
          esc(fmtAxis((max * i) / 4)) + "</text>";
      }

      let bars = "";
      d.months.forEach(function (mo, i) {
        const startX = L + i * gw + (gw - (2 * barW + gap)) / 2;
        const hInc = mo.income ? Math.max((mo.income / max) * plotH, 2) : 0;
        const hExp = mo.expense ? Math.max((mo.expense / max) * plotH, 2) : 0;
        if (hInc) {
          bars += '<rect class="an-bar-inc" x="' + startX.toFixed(1) + '" y="' + (T + plotH - hInc).toFixed(1) +
            '" width="' + barW + '" height="' + hInc.toFixed(1) + '" rx="3"></rect>';
        }
        if (hExp) {
          bars += '<rect class="an-bar-exp" x="' + (startX + barW + gap).toFixed(1) + '" y="' + (T + plotH - hExp).toFixed(1) +
            '" width="' + barW + '" height="' + hExp.toFixed(1) + '" rx="3"></rect>';
        }
        bars += '<text class="an-axis" x="' + (L + i * gw + gw / 2).toFixed(1) + '" y="' + (H - 8) +
          '" text-anchor="middle">' + esc(mo.label) + "</text>";
      });

      body =
        '<div class="an-chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Income versus expenses for the last 6 months">' +
        grid + bars + "</svg></div>";
    }

    return (
      '<section class="an-card"><div class="an-card-head"><div>' +
      '<h3 class="an-card-title">Income vs expenses</h3><p class="an-card-sub">Last 6 months</p></div>' +
      '<div class="an-legend"><span><i class="is-inc"></i>Income</span><span><i class="is-exp"></i>Expenses</span></div></div>' +
      body + "</section>"
    );
  }

  /* ---------- spending trend ---------- */
  function trendHTML(d) {
    const monthLabel = new Date().toLocaleDateString(undefined, { month: "long" });
    let body;

    if (!d.curExpense) {
      body = '<div class="an-empty">No spending in ' + esc(monthLabel) + " yet 🌿</div>";
    } else {
      const W = 360, H = 180, L = 40, R = 12, T = 10, B = 26;
      const plotW = W - L - R;
      const plotH = H - T - B;
      const days = d.daysInMonth;

      // Running total per day, up to today
      const cum = [];
      let run = 0;
      for (let i = 0; i < d.today; i++) {
        run += d.daily[i];
        cum.push(run);
      }
      const max = niceMax(run);
      const x = (day) => L + ((day - 1) / (days - 1 || 1)) * plotW;
      const y = (v) => T + plotH - (v / max) * plotH;

      let grid = "";
      for (let i = 0; i <= 4; i++) {
        const gy = T + plotH - (i / 4) * plotH;
        grid +=
          '<line class="an-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"></line>' +
          '<text class="an-axis" x="' + (L - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' +
          esc(fmtAxis((max * i) / 4)) + "</text>";
      }

      const labelDays = [];
      [1, Math.round(days / 2), days].forEach((n) => {
        if (labelDays.indexOf(n) === -1) labelDays.push(n);
      });
      const xLabels = labelDays
        .map((n) =>
          '<text class="an-axis" x="' + x(n).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + n + "</text>"
        )
        .join("");

      let shape = "";
      if (cum.length > 1) {
        const pts = cum.map((v, i) => x(i + 1).toFixed(1) + " " + y(v).toFixed(1));
        const baseY = (T + plotH).toFixed(1);
        shape =
          '<path class="an-area" d="M ' + pts.join(" L ") + " L " + x(cum.length).toFixed(1) + " " + baseY +
          " L " + x(1).toFixed(1) + " " + baseY + ' Z"></path>' +
          '<path class="an-line" d="M ' + pts.join(" L ") + '"></path>';
      }
      const lastX = x(cum.length).toFixed(1);
      const lastY = y(run).toFixed(1);
      shape += '<circle class="an-point" cx="' + lastX + '" cy="' + lastY + '" r="5"></circle>';

      const avg = Math.round(run / d.today);
      const pace = avg * days;

      body =
        '<div class="an-chart"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Running total of spending this month">' +
        grid + xLabels + shape + "</svg></div>" +
        '<p class="an-total"><span>Daily average <strong>' + esc(money(avg)) +
        "</strong></span><span>On pace for <strong>" + esc(money(pace)) + "</strong></span></p>";
    }

    return (
      '<section class="an-card"><div class="an-card-head"><div>' +
      '<h3 class="an-card-title">Spending trend</h3><p class="an-card-sub">Running total this month</p></div>' +
      '<strong style="font-size:var(--text-sm);color:var(--charcoal-900)">' + esc(money(d.curExpense)) + "</strong></div>" +
      body + "</section>"
    );
  }

  /* ---------- top categories ---------- */
  function rankHTML(d, colors) {
    const monthLabel = new Date().toLocaleDateString(undefined, { month: "long" });
    let body;

    if (!d.cats.length) {
      body = '<div class="an-empty">Your top categories will show up once you log some expenses 💸</div>';
    } else {
      body =
        '<ul class="an-rank">' +
        d.cats
          .slice(0, 5)
          .map(function (c, i) {
            const color = colors[c.name] || "var(--cat-8)";
            const pct = Math.round((c.value / d.curExpense) * 100);
            return (
              '<li><div class="an-rank-top"><span class="an-rank-n" style="background:' + color + '">' + (i + 1) + "</span>" +
              '<span class="an-rank-name">' + esc(c.name) + "</span>" +
              '<span class="an-rank-pct">' + pct + "%</span>" +
              '<span class="an-rank-amt">' + esc(money(c.value)) + "</span></div>" +
              '<div class="an-rank-bar"><div class="an-rank-fill" style="width:' + pct + "%;background:" + color + '"></div></div></li>'
            );
          })
          .join("") +
        "</ul>";
    }

    return (
      '<section class="an-card"><div class="an-card-head"><div>' +
      '<h3 class="an-card-title">Top categories</h3><p class="an-card-sub">' + esc(monthLabel) + " spending</p></div></div>" +
      body + "</section>"
    );
  }

  /* ---------- view ---------- */
  function paint(el) {
    const all = PT.store.list("transactions") || [];
    const d = compute(all);
    const colors = buildColorMap(all);

    el.innerHTML =
      '<div class="an">' +
      insightsHTML(d) +
      barsHTML(d) +
      '<div class="an-grid-2">' +
      trendHTML(d) +
      rankHTML(d, colors) +
      "</div></div>";
  }

  PT.views = PT.views || {};
  PT.views.analytics = {
    title: "Analytics",
    selfUpdating: true,

    render(el) {
      if (typeof unsubscribe === "function") unsubscribe();
      unsubscribe = null;

      paint(el);

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