/* PocketTrack data store.
   Everything is saved in this browser's localStorage, on this device only.
   It is NOT cloud sync: clearing browser data or switching browsers removes it. */
window.PT = window.PT || {};

PT.store = (function () {
  const KEY = "pockettrack:v1";
  const COLLECTIONS = ["transactions", "budgets", "goals", "recurring"];
  const listeners = [];
  let persistent = true;

  function defaults() {
    return {
      version: 1,
      transactions: [],
      budgets: [],
      goals: [],
      recurring: [],
      settings: { currency: "USD" }
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
    } catch (e) {
      persistent = false; // storage blocked (e.g. some private modes)
      return defaults();
    }
    if (!raw) return defaults();

    try {
      const parsed = JSON.parse(raw);
      const base = defaults();
      COLLECTIONS.forEach(function (name) {
        if (Array.isArray(parsed[name])) base[name] = parsed[name];
      });
      if (parsed.settings && typeof parsed.settings === "object") {
        base.settings = Object.assign(base.settings, parsed.settings);
      }
      return base;
    } catch (e) {
      // Unreadable data: keep a backup copy instead of silently destroying it.
      try {
        localStorage.setItem(KEY + ":corrupt-backup", raw);
      } catch (_) {}
      return defaults();
    }
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
      return true;
    } catch (e) {
      persistent = false;
      return false;
    }
  }

  function emit(change) {
    // Loop over a copy: listeners may unsubscribe themselves while we run.
    listeners.slice().forEach(function (fn) {
      try {
        fn(change);
      } catch (e) {
        console.error("PocketTrack listener error:", e);
      }
    });
  }

  function commit(change) {
    const ok = save();
    emit(change);
    return ok;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      const i = listeners.indexOf(fn);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  function isPersistent() {
    return persistent;
  }

  /* Settings */
  function getSettings() {
    return Object.assign({}, state.settings);
  }

  function updateSettings(patch) {
    Object.assign(state.settings, patch);
    return commit({ type: "settings" });
  }

  /* Collections: transactions, budgets, goals, recurring */
  function list(name) {
    return state[name].slice();
  }

  function add(name, item) {
    const record = Object.assign({ id: PT.util.uid(), createdAt: Date.now() }, item);
    state[name].push(record);
    commit({ type: name });
    return record;
  }

  function update(name, id, patch) {
    const index = state[name].findIndex(function (item) { return item.id === id; });
    if (index === -1) return null;
    state[name][index] = Object.assign({}, state[name][index], patch, { id: id });
    commit({ type: name });
    return state[name][index];
  }

  function remove(name, id) {
    const before = state[name].length;
    state[name] = state[name].filter(function (item) { return item.id !== id; });
    if (state[name].length === before) return false;
    commit({ type: name });
    return true;
  }

  /* Backup, restore and clear (used by Settings) */
  function exportData() {
    const data = { settings: Object.assign({}, state.settings) };
    COLLECTIONS.forEach(function (name) {
      data[name] = state[name].map(function (item) { return Object.assign({}, item); });
    });
    return {
      app: "PocketTrack",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: data
    };
  }

  // Checks a backup (text or object) and changes nothing.
  function inspectBackup(input) {
    let obj = input;
    if (typeof input === "string") {
      try {
        obj = JSON.parse(input);
      } catch (e) {
        return { ok: false, error: "That isn't a valid backup. It could not be read." };
      }
    }
    if (!obj || typeof obj !== "object") {
      return { ok: false, error: "That isn't a valid backup." };
    }
    if (obj.app && obj.app !== "PocketTrack") {
      return { ok: false, error: "That backup is from a different app." };
    }

    const src = obj.data && typeof obj.data === "object" ? obj.data : obj;
    const clean = defaults();
    let found = false;

    COLLECTIONS.forEach(function (name) {
      if (!Array.isArray(src[name])) return;
      found = true;
      clean[name] = src[name]
        .filter(function (item) { return item && typeof item === "object"; })
        .map(function (item) {
          return Object.assign({}, item, { id: item.id ? String(item.id) : PT.util.uid() });
        });
    });

    if (src.settings && typeof src.settings === "object") {
      found = true;
      clean.settings = Object.assign(clean.settings, src.settings);
    }
    if (typeof clean.settings.currency !== "string" || !clean.settings.currency) {
      clean.settings.currency = "USD";
    }

    if (!found) return { ok: false, error: "No PocketTrack data found in that backup." };

    return {
      ok: true,
      clean: clean,
      counts: {
        transactions: clean.transactions.length,
        budgets: clean.budgets.length,
        goals: clean.goals.length,
        recurring: clean.recurring.length
      }
    };
  }

  // Replaces everything with a backup that inspectBackup approved.
  function restoreBackup(clean) {
    state = clean;
    return commit({ type: "all" });
  }

  // Wipes transactions, budgets, goals and recurring. Keeps your settings.
  function clearData() {
    COLLECTIONS.forEach(function (name) { state[name] = []; });
    return commit({ type: "all" });
  }

  return {
    subscribe, isPersistent, getSettings, updateSettings, list, add, update, remove,
    exportData, inspectBackup, restoreBackup, clearData
  };
})();