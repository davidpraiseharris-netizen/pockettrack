/* Small shared UI helpers used by every screen. */
window.PT = window.PT || {};

PT.ui = (function () {
  const esc = function (v) { return PT.util.escapeHtml(v); };

  /* type: "success" (default) or "error" */
  function toast(message, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " toast-error" : "");
    el.textContent = message;
    root.appendChild(el);

    setTimeout(function () {
      el.classList.add("toast-out");
      el.addEventListener("animationend", function () { el.remove(); }, { once: true });
      setTimeout(function () { el.remove(); }, 400); // fallback if animations are off
    }, 2600);
  }

  function pageHeader(title, subtitle) {
    return (
      '<header class="page-header"><h1>' + esc(title) + "</h1>" +
      (subtitle ? "<p>" + esc(subtitle) + "</p>" : "") +
      "</header>"
    );
  }

  /* options: { icon, title, text } */
  function emptyState(options) {
    return (
      '<div class="empty">' +
      '<div class="empty-icon">' + PT.icons.get(options.icon) + "</div>" +
      "<h2>" + esc(options.title) + "</h2>" +
      "<p>" + esc(options.text) + "</p>" +
      "</div>"
    );
  }

  return { toast, pageHeader, emptyState };
})();