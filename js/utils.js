/* PocketTrack utilities.
   Money is stored as whole cents (integers) to avoid floating-point errors,
   e.g. $12.34 is stored as 1234. */
window.PT = window.PT || {};

PT.util = (function () {
  const CURRENCIES = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "British Pound" },
    { code: "LRD", name: "Liberian Dollar" },
    { code: "GHS", name: "Ghanaian Cedi" },
    { code: "NGN", name: "Nigerian Naira" },
    { code: "KES", name: "Kenyan Shilling" },
    { code: "ZAR", name: "South African Rand" },
    { code: "CAD", name: "Canadian Dollar" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "INR", name: "Indian Rupee" },
    { code: "JPY", name: "Japanese Yen" }
  ];

  const formatters = {};

  function getFormatter(code) {
    if (!formatters[code]) {
      try {
        formatters[code] = new Intl.NumberFormat("en-US", { style: "currency", currency: code });
      } catch (e) {
        formatters[code] = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }
    return formatters[code];
  }

  /* Format whole cents using the saved currency, e.g. 123450 -> "$1,234.50" */
  function formatMoney(cents) {
    const code = PT.store ? PT.store.getSettings().currency : "USD";
    return getFormatter(code).format((Number(cents) || 0) / 100);
  }

  /* Turn user input like "1,234.5" into cents. Returns null if invalid. */
  function toCents(input) {
    const cleaned = String(input).replace(/,/g, "").trim();
    if (cleaned === "" || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
    const value = Number(cleaned);
    if (!isFinite(value)) return null;
    return Math.round(value * 100);
  }

  /* Dates are handled as local "YYYY-MM-DD" strings, never UTC,
     so a transaction made at 11pm stays on the right day. */
  function toISODate(date) {
    const d = date || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function parseISODate(str) {
    const parts = String(str).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return { CURRENCIES, formatMoney, toCents, toISODate, parseISODate, uid, escapeHtml };
})();