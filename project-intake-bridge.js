(() => {
  "use strict";

  const INTAKE_PATH = "/solicitar-proyecto.html";
  const SERVICE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
  const MAX_SERVICES = 8;
  let syncTimer = 0;

  function selectedServiceIds() {
    return [...document.querySelectorAll("[data-remove-service]")]
      .map((node) => node.getAttribute("data-remove-service"))
      .filter((value) => SERVICE_ID_PATTERN.test(value || ""))
      .slice(0, MAX_SERVICES);
  }

  function intakeUrl(ids) {
    if (!ids.length) return INTAKE_PATH;
    const params = new URLSearchParams({ services: ids.join(",") });
    return `${INTAKE_PATH}?${params.toString()}`;
  }

  function setAttributeIfChanged(node, name, value) {
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }

  function syncRequestCta() {
    syncTimer = 0;
    const request = document.getElementById("request-payment");
    if (!request) return;

    const ids = selectedServiceIds();
    const disabled = ids.length === 0;
    const text = disabled ? "Selecciona servicios para solicitar proyecto" : "Solicitar proyecto";
    const href = disabled ? "#servicios" : intakeUrl(ids);

    if (request.textContent !== text) request.textContent = text;
    if (request.getAttribute("href") !== href) request.setAttribute("href", href);
    if (request.hasAttribute("target")) request.removeAttribute("target");
    if (request.hasAttribute("rel")) request.removeAttribute("rel");
    request.classList.toggle("is-disabled", disabled);
    setAttributeIfChanged(request, "aria-disabled", String(disabled));
    setAttributeIfChanged(request, "data-governed-intake", "true");
  }

  function queueSync() {
    if (syncTimer) return;
    // Use a new task rather than a microtask. CDP evidence showed the browser's
    // Runtime.callFunctionOn never returned after an application DOM click even
    // though the generic mouse-input probe passed. Keeping compatibility
    // reconciliation outside the originating click's microtask checkpoint makes
    // the legacy bridge non-reentrant with app.js' synchronous renderEstimate().
    syncTimer = window.setTimeout(syncRequestCta, 0);
  }

  function ensureIntakeNav() {
    const nav = document.querySelector(".site-header .nav");
    if (!nav || nav.querySelector('[data-intake-nav="true"]')) return;
    const link = document.createElement("a");
    link.href = INTAKE_PATH;
    link.textContent = "Solicitar proyecto";
    link.dataset.intakeNav = "true";
    nav.appendChild(link);
  }

  // Capture phase prevents the legacy app.js mailto/checkout URL from becoming
  // the external action. The next increment moves this ownership into app.js
  // itself and removes this compatibility layer entirely.
  document.addEventListener("click", (event) => {
    const request = event.target.closest?.("#request-payment");
    if (!request) return;

    event.preventDefault();
    event.stopPropagation();

    const ids = selectedServiceIds();
    if (!ids.length) {
      document.getElementById("servicios")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.assign(intakeUrl(ids));
  }, true);

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-add-service], [data-remove-service]")) return;
    queueSync();
  });

  // Temporary containment retained until the bridge is removed. It affects only
  // decorative pointer movement inside the commercial home; click semantics are
  // unchanged.
  document.addEventListener("pointermove", (event) => {
    if (!event.target.closest?.(".commercial-home")) return;
    event.stopPropagation();
  }, true);

  function start() {
    ensureIntakeNav();
    syncRequestCta();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
