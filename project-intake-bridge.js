(() => {
  "use strict";

  const INTAKE_PATH = "/solicitar-proyecto.html";
  const SERVICE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
  const MAX_SERVICES = 8;
  let syncQueued = false;

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
    syncQueued = false;
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
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(syncRequestCta);
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

  // app.js updates its selection synchronously in the service/remove button
  // handlers. This document-level bubbling listener runs after those handlers
  // and schedules exactly one CTA reconciliation without observing DOM writes.
  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-add-service], [data-remove-service]")) return;
    queueSync();
  });

  // Production browser evidence showed CDP mouse dispatch blocking for >60s
  // while app.js' decorative homepage pointermove handler synchronously forced
  // layout (getBoundingClientRect) and CSS-variable writes. Stop only pointermove
  // propagation inside the commercial home; click/pointerdown/pointerup remain
  // untouched. This containment is temporary and is removed with the bridge
  // when app.js becomes the sole configurator owner.
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
