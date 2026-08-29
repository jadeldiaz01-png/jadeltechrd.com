(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("view");
  const view = requested === "privacy" || requested === "terms" ? requested : "home";

  const titles = {
    home: "Jadel Tech RD",
    privacy: "Política de Privacidad | Jadel Tech RD",
    terms: "Condiciones del Servicio | Jadel Tech RD",
  };

  const descriptions = {
    home: "Sitio oficial de Jadel Tech RD para información pública de aplicaciones y servicios.",
    privacy: "Política de Privacidad de las aplicaciones y servicios de Jadel Tech RD.",
    terms: "Condiciones del Servicio de las aplicaciones y servicios de Jadel Tech RD.",
  };

  document.title = titles[view];
  const description = document.querySelector('meta[name="description"]');
  if (description) description.setAttribute("content", descriptions[view]);

  document.querySelectorAll("[data-view]").forEach((node) => {
    node.hidden = node.getAttribute("data-view") !== view;
  });

  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.getAttribute("data-nav") === view) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = view === "home"
    ? "https://jadeltechrd.com/"
    : `https://jadeltechrd.com/?view=${view}`;
  document.head.appendChild(canonical);

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
