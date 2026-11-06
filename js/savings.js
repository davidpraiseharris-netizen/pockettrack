/* PocketTrack Savings goals. Mounted into the Budgets screen via PT.savings.mount(el). */
(function () {
  "use strict";

  const state = { confirmId: null };
  let sheet = null;

  /* ---------- helpers ---------- */
  const esc = (s) => PT.util.escapeHtml(String(s == null ? "" : s));

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

  function parseCents(str) {
    const n = parseFloat(String(str).replace(/,/g, "").trim());
    return isFinite(n) ? Math.round(n * 100) : 0;
  }

  const ICON_EDIT =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_TRASH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';

  /* ---------- paint ---------- */
  function ringHTML(pct) {
    const R = 30;
    const C = 2 * Math.PI * R;
    const len = (pct / 100) * C;
    return (
      '<div class="sv-ring"><svg viewBox="0 0 72 72" aria-hidden="true">' +
      '<circle class="sv-ring-track" cx="36" cy="36" r="' + R + '" fill="none" stroke-width="8"></circle>' +
      '<circle class="sv-ring-fill" cx="36" cy="36" r="' + R + '" fill="none" stroke-width="8" stroke-linecap="round" ' +
      'stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) + '"></circle></svg>' +
      '<span class="sv-ring-pct">' + pct + "%</span></div>"
    );
  }

  function cardHTML(g) {
    const target = Number(g.target) || 0;
    const saved = Number(g.saved) || 0;
    const done = target > 0 && saved >= target;
    const pct = done ? 100 : Math.min(99, Math.floor(target ? (saved / target) * 100 : 0));
    const confirming = state.confirmId === g.id;

    const tail = confirming
      ? '<button type="button" class="sv-btn is-confirm" data-sv-confirm="' + esc(g.id) + '">Delete?</button>'
      : '<button type="button" class="sv-btn" data-sv-edit="' + esc(g.id) + '" aria-label="Edit goal">' + ICON_EDIT + "</button>" +
        '<button type="button" class="sv-btn is-danger" data-sv-del="' + esc(g.id) + '" aria-label="Delete goal">' + ICON_TRASH + "</button>";

    return (
      '<article class="sv-card' + (done ? " is-done" : "") + '">' +
      '<div class="sv-top">' + ringHTML(pct) +
      '<div class="sv-main"><p class="sv-name">' + esc(g.name) + "</p>" +
      '<p class="sv-nums"><strong>' + esc(money(saved)) + "</strong> of " + esc(money(target)) + "</p>" +
      (done
        ? '<span class="sv-badge">Goal reached 🎉</span>'
        : '<p class="sv-left">' + esc(money(target - saved)) + " to go</p>") +
      "</div></div>" +
      '<div class="sv-actions"><button type="button" class="sv-fund" data-sv-fund="' + esc(g.id) + '">+ Add / withdraw</button>' +
      tail + "</div></article>"
    );
  }

  function sectionHTML() {
    const goals = (PT.store.list("goals") || []).slice().sort(function (a, b) {
      const da = a.saved >= a.target ? 1 : 0;
      const db = b.saved >= b.target ? 1 : 0;
      if (da !== db) return da - db;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    const body = goals.length
      ? '<div class="sv-list">' + goals.map(cardHTML).join("") + "</div>"
      : '<div class="sv-empty">No savings goals yet.<br>Create one, like a new phone or an emergency fund 🎯</div>';

    return (
      '<div class="sv"><div class="sv-head"><h3 class="sv-title">Savings goals</h3>' +
      '<button type="button" class="sv-add" data-sv-add>+ New goal</button></div>' +
      body + "</div>"
    );
  }

  /* ---------- sheets ---------- */
  function closeSheet() {
    if (!sheet) return;
    const el = sheet;
    sheet = null;
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    el.classList.remove("is-open");
    setTimeout(function () { el.remove(); }, 250);
  }

  function onKey(e) {
    if (e.key === "Escape") closeSheet();
  }

  function makeSheet(title, inner) {
    sheet = document.createElement("div");
    sheet.className = "sheet-backdrop";
    sheet.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><h2 class="sheet-title">' + esc(title) + "</h2>" +
      '<button type="button" class="sheet-close" data-close aria-label="Close">&times;</button></div>' +
      '<div class="tf">' + inner + "</div></div>";
    document.body.appendChild(sheet);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(function () { sheet.classList.add("is-open"); });
    return sheet;
  }

  function openGoalSheet(goal) {
    if (sheet) return;
    const editing = !!(goal && goal.id);

    makeSheet(
      editing ? "Edit goal" : "New savings goal",
      '<div class="tf-field"><label class="tf-label" for="sg-name">Goal name</label>' +
        '<input class="tf-input" id="sg-name" type="text" maxlength="40" placeholder="e.g. New phone"></div>' +
        '<div class="tf-field"><span class="tf-label">Target amount</span>' +
        '<div class="tf-amount"><span class="tf-amount-sym">' + esc(currencySymbol()) + "</span>" +
        '<input id="sg-target" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Target amount"></div></div>' +
        '<p class="tf-error" id="sg-error" role="alert"></p>' +
        '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
        '<button type="button" class="tf-save" id="sg-save">' + (editing ? "Save changes" : "Create goal") + "</button></div>"
    );

    const $ = (s) => sheet.querySelector(s);
    const nameEl = $("#sg-name");
    const targetEl = $("#sg-target");
    const errEl = $("#sg-error");

    if (editing) {
      nameEl.value = goal.name || "";
      targetEl.value = (Number(goal.target) / 100).toFixed(2);
    }

    function save() {
      const name = nameEl.value.trim();
      const cents = parseCents(targetEl.value);
      if (!name) { errEl.textContent = "Give your goal a name."; nameEl.focus(); return; }
      if (cents <= 0) { errEl.textContent = "Enter a target greater than 0."; targetEl.focus(); return; }

      if (editing) {
        PT.store.update("goals", goal.id, { name: name, target: cents });
      } else {
        PT.store.add("goals", { name: name, target: cents, saved: 0, createdAt: Date.now() });
      }
      closeSheet();
      if (PT.ui && PT.ui.toast) PT.ui.toast(editing ? "Goal updated" : "Goal created");
    }

    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) return closeSheet();
      if (e.target.closest("#sg-save")) save();
    });
    nameEl.addEventListener("input", function () { errEl.textContent = ""; });
    targetEl.addEventListener("input", function () {
      errEl.textContent = "";
      targetEl.value = targetEl.value.replace(/[^0-9.,]/g, "");
    });
    [nameEl, targetEl].forEach(function (el) {
      el.addEventListener("keydown", function (e) { if (e.key === "Enter") save(); });
    });

    if (!editing) setTimeout(function () { nameEl.focus(); }, 300);
  }

  function openFundSheet(goal) {
    if (sheet) return;
    let mode = "add";

    makeSheet(
      goal.name || "Savings goal",
      '<div class="tf-type">' +
        '<button type="button" class="is-income" data-mode="add">Add money</button>' +
        '<button type="button" class="is-expense" data-mode="withdraw">Withdraw</button></div>' +
        '<div class="tf-amount"><span class="tf-amount-sym">' + esc(currencySymbol()) + "</span>" +
        '<input id="sf-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Amount"></div>' +
        '<p class="tf-label" style="text-align:center;margin:0">Saved so far: ' + esc(money(Number(goal.saved) || 0)) + "</p>" +
        '<p class="tf-error" id="sf-error" role="alert"></p>' +
        '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
        '<button type="button" class="tf-save" id="sf-save">Confirm</button></div>'
    );

    const $ = (s) => sheet.querySelector(s);
    const amountEl = $("#sf-amount");
    const errEl = $("#sf-error");

    function paintMode() {
      sheet.querySelectorAll("[data-mode]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-mode") === mode);
      });
    }

    function save() {
      const cents = parseCents(amountEl.value);
      const saved = Number(goal.saved) || 0;
      const target = Number(goal.target) || 0;

      if (cents <= 0) { errEl.textContent = "Enter an amount greater than 0."; amountEl.focus(); return; }
      if (mode === "withdraw" && cents > saved) {
        errEl.textContent = "You only have " + money(saved) + " saved here.";
        return;
      }

      const next = mode === "add" ? saved + cents : saved - cents;
      PT.store.update("goals", goal.id, { saved: next });
      closeSheet();

      if (PT.ui && PT.ui.toast) {
        if (mode === "add" && saved < target && next >= target) PT.ui.toast("Goal reached! 🎉");
        else PT.ui.toast(mode === "add" ? "Money added" : "Money withdrawn");
      }
    }

    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) return closeSheet();
      const m = e.target.closest("[data-mode]");
      if (m) { mode = m.getAttribute("data-mode"); errEl.textContent = ""; paintMode(); return; }
      if (e.target.closest("#sf-save")) save();
    });
    amountEl.addEventListener("input", function () {
      errEl.textContent = "";
      amountEl.value = amountEl.value.replace(/[^0-9.,]/g, "");
    });
    amountEl.addEventListener("keydown", function (e) { if (e.key === "Enter") save(); });

    paintMode();
    setTimeout(function () { amountEl.focus(); }, 300);
  }

  /* ---------- mount ---------- */
  function findGoal(id) {
    return (PT.store.list("goals") || []).find(function (g) { return g.id === id; });
  }

  function mount(el) {
    el.innerHTML = sectionHTML();

    el.onclick = function (e) {
      if (e.target.closest("[data-sv-add]")) return openGoalSheet();

      const fund = e.target.closest("[data-sv-fund]");
      if (fund) {
        const g = findGoal(fund.getAttribute("data-sv-fund"));
        if (g) openFundSheet(g);
        return;
      }

      const edit = e.target.closest("[data-sv-edit]");
      if (edit) {
        const g = findGoal(edit.getAttribute("data-sv-edit"));
        if (g) openGoalSheet(g);
        return;
      }

      const del = e.target.closest("[data-sv-del]");
      if (del) {
        state.confirmId = del.getAttribute("data-sv-del");
        mount(el);
        return;
      }

      const conf = e.target.closest("[data-sv-confirm]");
      if (conf) {
        state.confirmId = null;
        PT.store.remove("goals", conf.getAttribute("data-sv-confirm"));
        if (PT.ui && PT.ui.toast) PT.ui.toast("Goal deleted");
        return;
      }

      // Tapped anywhere else: cancel a pending delete
      if (state.confirmId) {
        state.confirmId = null;
        mount(el);
      }
    };
  }

  PT.savings = { mount: mount };
})();