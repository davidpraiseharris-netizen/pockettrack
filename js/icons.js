/* PocketTrack icons: small inline SVGs, no external files or libraries. */
window.PT = window.PT || {};

PT.icons = (function () {
  const PATHS = {
    dashboard:
      '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    transactions:
      '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    analytics:
      '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    budgets:
      '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    settings:
      '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    device:
      '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    pocket:
      '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a8 8 0 0 1-16 0z"/><path d="M8 10l4 3 4-3"/>'
  };

  function get(name) {
    const inner = PATHS[name] || "";
    return (
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      "</svg>"
    );
  }

  return { get };
})();