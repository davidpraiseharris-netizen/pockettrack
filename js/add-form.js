/* PocketTrack add / edit transaction sheet. Opens from the + button and from edit buttons. */
(function () {
  "use strict";

  const CATEGORIES = {
    expense: ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Education", "Other"],
    income: ["Salary", "Freelance", "Business", "Gift", "Other"],
  };

  let backdrop = null;

  const esc = (s) => PT.util.escapeHtml(String(s == null ? "" : s));

  function currencySymbol() {
    try {
      const cur = PT.store.getSettings().currency;
      const s = PT.util.formatMoney(0, cur).replace(/[0-9.,\s\u00a0-]/g, "");
      return s || "$";
    } catch (e) {
      return "$";
    }
  }

  function todayISO() {
    return PT.util.toISODate(new Date());
  }

  function toCentsSafe(str) {
    const n = parseFloat(String(str).replace(/,/g, "").trim());
    if (!isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function close() {
    if (!backdrop) return;
    const el = backdrop;
    backdrop = null;
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
    el.classList.remove("is-open");
    setTimeout(function () {
      el.remove();
    }, 250);
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function open(tx) {
    if (backdrop) return;
    const editing = !!(tx && tx.id);

    const state = {
      type: editing ? tx.type : "expense",
      category: editing ? tx.category : "",
    };

    backdrop = document.createElement("div");
    backdrop.className = "sheet-backdrop";
    backdrop.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' +
      (editing ? "Edit transaction" : "Add transaction") +
      '">' +
      '<div class="sheet-grab"></div>' +
      '<div class="sheet-head"><h2 class="sheet-title">' +
      (editing ? "Edit transaction" : "Add transaction") +
      '</h2><button type="button" class="sheet-close" data-close aria-label="Close">&times;</button></div>' +
      '<div class="tf">' +
      '<div class="tf-type">' +
      '<button type="button" class="is-expense" data-type="expense">Expense</button>' +
      '<button type="button" class="is-income" data-type="income">Income</button>' +
      "</div>" +
      '<div class="tf-amount"><span class="tf-amount-sym">' +
      esc(currencySymbol()) +
      '</span><input id="tf-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Amount"></div>' +
      '<div class="tf-field"><span class="tf-label">Category</span><div class="tf-cats" id="tf-cats"></div></div>' +
      '<div class="tf-field"><label class="tf-label" for="tf-note">Note (optional)</label>' +
      '<input class="tf-input" id="tf-note" type="text" maxlength="60" placeholder="e.g. Lunch with friends"></div>' +
      '<div class="tf-field"><label class="tf-label" for="tf-date">Date</label>' +
      '<input class="tf-input" id="tf-date" type="date"></div>' +
      '<p class="tf-error" id="tf-error" role="alert"></p>' +
      '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
      '<button type="button" class="tf-save" id="tf-save">' +
      (editing ? "Save changes" : "Save") +
      "</button></div>" +
      "</div></div>";

    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);

    const $ = (sel) => backdrop.querySelector(sel);
    const amountEl = $("#tf-amount");
    const noteEl = $("#tf-note");
    const dateEl = $("#tf-date");
    const errEl = $("#tf-error");
    const catsEl = $("#tf-cats");

    dateEl.value = editing ? tx.date : todayISO();
    if (editing) {
      amountEl.value = (Math.abs(tx.amount) / 100).toFixed(2);
      noteEl.value = tx.note || "";
    }

    function paintType() {
      backdrop.querySelectorAll("[data-type]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-type") === state.type);
      });
    }

    function paintCats() {
      const list = CATEGORIES[state.type].slice();
      if (state.category && list.indexOf(state.category) === -1) list.push(state.category);
      catsEl.innerHTML = list
        .map(function (c) {
          return (
            '<button type="button" class="tf-cat' +
            (c === state.category ? " is-active" : "") +
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
      const cents = toCentsSafe(amountEl.value);
      if (cents <= 0) {
        errEl.textContent = "Enter an amount greater than 0.";
        amountEl.focus();
        return;
      }
      if (!state.category) {
        errEl.textContent = "Pick a category.";
        return;
      }
      if (!dateEl.value) {
        errEl.textContent = "Pick a date.";
        return;
      }

      const data = {
        type: state.type,
        amount: cents,
        category: state.category,
        note: noteEl.value.trim(),
        date: dateEl.value,
      };

      if (editing) {
        PT.store.update("transactions", tx.id, data);
      } else {
        data.createdAt = Date.now();
        PT.store.add("transactions", data);
      }

      close();
      if (PT.ui && PT.ui.toast) PT.ui.toast(editing ? "Transaction updated" : "Transaction added");
    }

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop || e.target.closest("[data-close]")) {
        close();
        return;
      }
      const typeBtn = e.target.closest("[data-type]");
      if (typeBtn) {
        const next = typeBtn.getAttribute("data-type");
        if (next !== state.type) {
          state.type = next;
          if (CATEGORIES[next].indexOf(state.category) === -1) state.category = "";
          paintType();
          paintCats();
        }
        return;
      }
      const catBtn = e.target.closest("[data-cat]");
      if (catBtn) {
        state.category = catBtn.getAttribute("data-cat");
        errEl.textContent = "";
        paintCats();
        return;
      }
      if (e.target.closest("#tf-save")) save();
    });

    amountEl.addEventListener("input", function () {
      errEl.textContent = "";
      amountEl.value = amountEl.value.replace(/[^0-9.,]/g, "");
    });
    [amountEl, noteEl].forEach(function (el) {
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") save();
      });
    });

    paintType();
    paintCats();

    requestAnimationFrame(function () {
      backdrop.classList.add("is-open");
    });
    if (!editing) setTimeout(function () { amountEl.focus(); }, 300);
  }

  PT.addForm = { open: open, close: close };

  // Wire the floating + button (replaces the old "coming soon" toast)
  if (PT.app) PT.app.openAdd = function () { open(); };
})();