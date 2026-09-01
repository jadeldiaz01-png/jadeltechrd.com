(() => {
  "use strict";

  const INTAKE_PATH = "/solicitar-proyecto.html";
  const SERVICE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
  const MAX_SERVICES = 8;

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

  function ensureIntakeNav() {
    const nav = document.querySelector(".site-header .nav");
    if (!nav || nav.querySelector('[data-intake-nav="true"]')) return;
    const link = document.createElement("a");
    link.href = INTAKE_PATH;
    link.textContent = "Solicitar proyecto";
    link.dataset.intakeNav = "true";
    nav.appendChild(link);
  }

  // Capture phase intentionally wins over the legacy app.js mailto default.
  // This remains a compatibility shim until app.js owns the governed intake URL directly.
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

  function start() {
    ensureIntakeNav();
    syncRequestCta();

    const selectedContainer = document.getElementById("selected-services");
    if (!selectedContainer) return;

    // Observe only the selection model. Observing document.body caused a feedback loop
    // because rewriting the CTA text itself generated additional childList mutations.
    const observer = new MutationObserver(() => syncRequestCta());
    observer.observe(selectedContainer, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
