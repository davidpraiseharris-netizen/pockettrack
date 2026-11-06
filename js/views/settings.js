/* PocketTrack Settings: currency, backup (download / copy), import, reset. */
(function () {
  "use strict";

  const CURRENCIES = [
    ["USD", "US Dollar"], ["EUR", "Euro"], ["GBP", "British Pound"],
    ["LRD", "Liberian Dollar"], ["GHS", "Ghanaian Cedi"], ["NGN", "Nigerian Naira"],
    ["KES", "Kenyan Shilling"], ["ZAR", "South African Rand"], ["XOF", "West African CFA Franc"],
    ["CAD", "Canadian Dollar"], ["AUD", "Australian Dollar"], ["INR", "Indian Rupee"],
    ["AED", "UAE Dirham"], ["JPY", "Japanese Yen"],
  ];

  let sheet = null;

  /* ---------- helpers ---------- */
  const esc = (s) => PT.util.escapeHtml(String(s == null ? "" : s));

  function toast(msg) {
    if (PT.ui && PT.ui.toast) PT.ui.toast(msg);
  }

  function sample(cur) {
    try {
      return PT.util.formatMoney(123456, cur);
    } catch (e) {
      return "";
    }
  }

  function stamp() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function prettyDate(isoStr) {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function backupText() {
    return JSON.stringify(PT.store.exportData(), null, 2);
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => legacyCopy(text)
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  function countsList(c) {
    const rows = [
      ["Transactions", c.transactions],
      ["Budgets", c.budgets],
      ["Savings goals", c.goals],
    ];
    if (c.recurring) rows.push(["Recurring", c.recurring]);
    return (
      '<ul class="st-counts">' +
      rows.map((r) => "<li><span>" + r[0] + "</span><strong>" + r[1] + "</strong></li>").join("") +
      "</ul>"
    );
  }

  function currentCounts() {
    return {
      transactions: PT.store.list("transactions").length,
      budgets: PT.store.list("budgets").length,
      goals: PT.store.list("goals").length,
      recurring: PT.store.list("recurring").length,
    };
  }

  /* ---------- sheet ---------- */
  function onKey(e) {
    if (e.key === "Escape") closeSheet();
  }

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

  function makeSheet(title, inner) {
    closeSheet();
    sheet = document.createElement("div");
    sheet.className = "sheet-backdrop";
    sheet.innerHTML =
      '<div class="sheet" role="dialog" aria-modal="true" aria-label="' +
      esc(title) +
      '"><div class="sheet-grab"></div>' +
      '<div class="sheet-head"><h2 class="sheet-title">' +
      esc(title) +
      '</h2><button type="button" class="sheet-close" data-close aria-label="Close">&times;</button></div>' +
      '<div class="tf">' +
      inner +
      "</div></div>";
    document.body.appendChild(sheet);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(function () {
      if (sheet) sheet.classList.add("is-open");
    });
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) closeSheet();
    });
    return sheet;
  }

  /* ---------- flows ---------- */
  function confirmImport(clean, counts) {
    const s = makeSheet(
      "Replace your data?",
      '<p class="st-confirm-text">This backup contains:</p>' +
        countsList(counts) +
        '<p class="st-confirm-text"><strong>Importing replaces everything currently in PocketTrack.</strong> Your current data will be gone. Export it first if you want to keep it.</p>' +
        '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
        '<button type="button" class="tf-save" id="st-do-import">Replace my data</button></div>'
    );
    s.querySelector("#st-do-import").addEventListener("click", function () {
      PT.store.restoreBackup(clean);
      closeSheet();
      toast("Backup restored");
    });
  }

  function handleImportText(text, onError) {
    const result = PT.store.inspectBackup(text);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    confirmImport(result.clean, result.counts);
  }

  function openPasteSheet() {
    const s = makeSheet(
      "Paste a backup",
      '<div class="tf-field"><label class="tf-label" for="st-paste">Backup text</label>' +
        '<textarea class="tf-input" id="st-paste" rows="8" placeholder="Paste the copied backup here" style="resize:vertical;font-size:var(--text-sm)"></textarea></div>' +
        '<p class="tf-error" id="st-paste-error" role="alert"></p>' +
        '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
        '<button type="button" class="tf-save" id="st-paste-go">Continue</button></div>'
    );
    const box = s.querySelector("#st-paste");
    const err = s.querySelector("#st-paste-error");
    box.addEventListener("input", function () {
      err.textContent = "";
    });
    s.querySelector("#st-paste-go").addEventListener("click", function () {
      if (!box.value.trim()) {
        err.textContent = "Paste your backup text first.";
        return;
      }
      handleImportText(box.value, function (m) {
        err.textContent = m;
      });
    });
    setTimeout(function () {
      box.focus();
    }, 300);
  }

  function openResetSheet() {
    const counts = currentCounts();
    const s = makeSheet(
      "Delete all data?",
      '<p class="st-confirm-text">This permanently deletes:</p>' +
        countsList(counts) +
        '<p class="st-confirm-text"><strong>This cannot be undone.</strong> Your currency setting is kept. Export a backup first if you might want this data again.</p>' +
        '<div class="tf-actions"><button type="button" class="tf-cancel" data-close>Cancel</button>' +
        '<button type="button" class="tf-save" id="st-do-reset" style="background:var(--expense);box-shadow:none">Delete everything</button></div>'
    );
    s.querySelector("#st-do-reset").addEventListener("click", function () {
      PT.store.clearData();
      closeSheet();
      toast("All data deleted");
    });
  }

  /* ---------- paint ---------- */
  function paint(el) {
    const settings = PT.store.getSettings();
    const cur = settings.currency || "USD";
    const options = CURRENCIES.slice();
    if (!options.some((c) => c[0] === cur)) options.push([cur, cur]);

    const persistent = PT.store.isPersistent();
    const noteHTML = persistent
      ? '<div class="st-note"><span class="st-note-emoji">📱</span><div><strong>Your data lives on this device.</strong> It is not synced to the cloud, so clearing your browser data would erase it. Export a backup now and then.</div></div>'
      : '<div class="st-note is-warn"><span class="st-note-emoji">⚠️</span><div><strong>Saving is blocked in this browser.</strong> Your changes may disappear when you close the page. Export a backup to be safe.</div></div>';

    const last = settings.lastBackup ? prettyDate(settings.lastBackup) : "";

    el.innerHTML =
      '<div class="st">' +
      noteHTML +
      // Preferences
      '<section class="st-card"><h3 class="st-card-title">Preferences</h3>' +
      '<div class="st-row"><div class="st-row-main"><p class="st-row-title">Currency</p>' +
      '<p class="st-row-sub">Preview: ' +
      esc(sample(cur)) +
      '</p></div><select class="st-select" id="st-currency" aria-label="Currency">' +
      options
        .map(
          (c) =>
            '<option value="' + esc(c[0]) + '"' + (c[0] === cur ? " selected" : "") + ">" +
            esc(c[0] === c[1] ? c[0] : c[0] + " · " + c[1]) + "</option>"
        )
        .join("") +
      "</select></div></section>" +
      // Backup
      '<section class="st-card"><h3 class="st-card-title">Backup</h3>' +
      '<p class="st-card-sub">Save a copy of everything: transactions, budgets and goals.' +
      (last ? " Last backup: " + esc(last) + "." : " You haven't made a backup yet.") +
      "</p>" +
      '<div class="st-row"><div class="st-row-main"><p class="st-row-title">Download backup</p>' +
      '<p class="st-row-sub">Saves a file you can keep or move to another device.</p></div>' +
      '<button type="button" class="st-btn is-solid" data-export-file>Download</button></div>' +
      '<div class="st-row"><div class="st-row-main"><p class="st-row-title">Copy backup</p>' +
      '<p class="st-row-sub">Use this if downloading doesn\'t work here. Paste it into a note or message to yourself.</p></div>' +
      '<button type="button" class="st-btn" data-export-copy>Copy</button></div></section>' +
      // Import
      '<section class="st-card"><h3 class="st-card-title">Restore</h3>' +
      '<p class="st-card-sub">Bring your data back from a backup. This replaces what is currently in the app.</p>' +
      '<div class="st-row"><div class="st-row-main"><p class="st-row-title">Import from file</p>' +
      '<p class="st-row-sub">Pick a PocketTrack backup file.</p></div>' +
      '<button type="button" class="st-btn" data-import-file>Choose file</button></div>' +
      '<div class="st-row"><div class="st-row-main"><p class="st-row-title">Import from pasted text</p>' +
      '<p class="st-row-sub">Paste a backup you copied earlier.</p></div>' +
      '<button type="button" class="st-btn" data-import-paste>Paste</button></div>' +
      '<input class="st-file" id="st-file" type="file" accept=".json,application/json,text/plain"></section>' +
      // Danger
      '<section class="st-card is-danger"><h3 class="st-card-title">Danger zone</h3>' +
      '<p class="st-card-sub">Wipe all transactions, budgets and goals from this device.</p>' +
      '<button type="button" class="st-btn is-danger" data-reset>Delete all data</button></section>' +
      '<p class="st-about">PocketTrack · your data stays on this device</p>' +
      "</div>";
  }

  /* ---------- view ---------- */
  PT.views = PT.views || {};
  PT.views.settings = {
    title: "Settings",
    // Not selfUpdating: the app repaints this screen after any store change.

    render(el) {
      paint(el);

      el.onchange = function (e) {
        if (e.target.id === "st-currency") {
          PT.store.updateSettings({ currency: e.target.value });
          toast("Currency updated");
          return;
        }
        if (e.target.id === "st-file") {
          const input = e.target;
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function () {
            input.value = "";
            handleImportText(String(reader.result || ""), toast);
          };
          reader.onerror = function () {
            input.value = "";
            toast("Couldn't read that file.");
          };
          reader.readAsText(file);
        }
      };

      el.onclick = function (e) {
        if (e.target.closest("[data-export-file]")) {
          const text = backupText();
          try {
            download("pockettrack-backup-" + stamp() + ".json", text);
            PT.store.updateSettings({ lastBackup: new Date().toISOString() });
            toast("Backup downloaded");
          } catch (err) {
            toast("Download failed. Try Copy backup instead.");
          }
          return;
        }

        if (e.target.closest("[data-export-copy]")) {
          copyText(backupText()).then(function (ok) {
            if (ok) {
              PT.store.updateSettings({ lastBackup: new Date().toISOString() });
              toast("Backup copied. Paste it somewhere safe.");
            } else {
              toast("Couldn't copy. Try Download instead.");
            }
          });
          return;
        }

        if (e.target.closest("[data-import-file]")) {
          const input = el.querySelector("#st-file");
          if (input) input.click();
          return;
        }

        if (e.target.closest("[data-import-paste]")) {
          openPasteSheet();
          return;
        }

        if (e.target.closest("[data-reset]")) {
          openResetSheet();
        }
      };
    },
  };
})();