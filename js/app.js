/* PocketTrack app shell: navigation, routing and the floating + button. */
window.PT = window.PT || {};

PT.app = (function () {
  const ROUTES = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "transactions", label: "Transactions", icon: "transactions" },
    { id: "analytics", label: "Analytics", icon: "analytics" },
    { id: "budgets", label: "Budgets", icon: "budgets" },
    { id: "settings", label: "Settings", icon: "settings" }
  ];

  let viewEl, sidebarEl, bottomNavEl;

  function currentId() {
    const hash = location.hash.replace(/^#\/?/, "");
    return ROUTES.some(function (r) { return r.id === hash; }) ? hash : "dashboard";
  }

  function navLinks(extraClass) {
    return ROUTES.map(function (r) {
      return (
        '<a class="nav-link ' + extraClass + '" href="#/' + r.id + '" data-route="' + r.id + '">' +
        PT.icons.get(r.icon) + "<span>" + r.label + "</span></a>"
      );
    }).join("");
  }

  function renderShell() {
    sidebarEl.innerHTML =
      '<div class="brand">' +
        '<div class="brand-mark">' + PT.icons.get("pocket") + "</div>" +
        '<span class="brand-name">PocketTrack</span>' +
      "</div>" +
      '<nav class="side-nav" aria-label="Main">' + navLinks("side-link") + "</nav>" +
      '<div class="side-note"><strong>Stored on this device</strong>' +
      "Your data stays in this browser. It is not synced to the cloud.</div>";

    bottomNavEl.innerHTML = navLinks("");
    document.getElementById("fab-icon").innerHTML = PT.icons.get("plus");
  }

  function setActive(id) {
    document.querySelectorAll("[data-route]").forEach(function (link) {
      if (link.dataset.route === id) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function render(isNavigation) {
    const id = currentId();
    const view = PT.views[id];
    if (location.hash !== "#/" + id) history.replaceState(null, "", "#/" + id);

    setActive(id);
    document.title = view.title + " · PocketTrack";

    // Fresh container every time, so a screen you left can never repaint over this one.
    const fresh = viewEl.cloneNode(false);
    viewEl.replaceWith(fresh);
    viewEl = fresh;

    viewEl.classList.remove("view-enter");
    viewEl.innerHTML = "";
    view.render(viewEl);
    void viewEl.offsetWidth; // restart the entrance animation
    viewEl.classList.add("view-enter");

    if (isNavigation) {
      window.scrollTo(0, 0);
      viewEl.focus({ preventScroll: true });
    }
  }

  /* Opens the add transaction sheet. */
  function openAdd() {
    if (PT.addForm) PT.addForm.open();
  }

  function init() {
    viewEl = document.getElementById("view");
    sidebarEl = document.getElementById("sidebar");
    bottomNavEl = document.getElementById("bottom-nav");

    renderShell();
    document.getElementById("fab").addEventListener("click", openAdd);
    window.addEventListener("hashchange", function () { render(true); });

    PT.store.subscribe(function () {
      const view = PT.views[currentId()];
      if (!view.selfUpdating) render(false);
    });

    render(false);
  }

  init();
  return { openAdd, render };
})();