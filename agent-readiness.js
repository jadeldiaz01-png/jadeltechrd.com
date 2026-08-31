(() => {
  const grid = document.querySelector("#readiness-grid");
  const summary = document.querySelector("#readiness-summary");
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const statusClass = (maturity) => {
    if (maturity === "service") return "available";
    if (maturity === "pilot") return "pilot";
    return "research";
  };

  const card = (agent) => {
    const blockers = Array.isArray(agent.production_blockers) ? agent.production_blockers : [];
    const approvals = Array.isArray(agent.human_approval_points) ? agent.human_approval_points : [];
    const controls = Array.isArray(agent.verified_controls) ? agent.verified_controls : [];
    return `
      <article class="service-card">
        <div class="service-topline">
          <span class="service-icon" aria-hidden="true">${agent.category === "media" ? "▶" : agent.category === "research" ? "∑" : "◇"}</span>
          <span class="status-badge status-${statusClass(agent.maturity)}">${escapeHtml(agent.maturity)}</span>
        </div>
        <h2>${escapeHtml(agent.name)}</h2>
        <p><strong>Estado:</strong> ${escapeHtml(agent.production_state)}</p>
        <p><strong>Modo permitido:</strong> ${escapeHtml(agent.allowed_service_mode)}</p>
        <p><strong>Repositorio:</strong> ${escapeHtml(agent.repository)}</p>
        <h3>Controles verificados</h3>
        <ul class="service-deliverables">${controls.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Sin evidencia registrada todavía</li>"}</ul>
        <h3>Bloqueos de producción</h3>
        <ul class="service-deliverables">${blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Sin bloqueos declarados</li>"}</ul>
        <h3>Aprobación humana</h3>
        <ul class="service-deliverables">${approvals.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>No aplica a este artefacto</li>"}</ul>
      </article>`;
  };

  const renderSummary = (agents) => {
    const pilots = agents.filter((agent) => agent.maturity === "pilot").length;
    const research = agents.filter((agent) => agent.maturity === "research").length;
    const commercial = agents.filter((agent) => agent.commercial_surface).length;
    summary.innerHTML = `
      <div><strong>${agents.length}</strong><span>agentes registrados</span></div>
      <div><strong>${pilots}</strong><span>pilotos supervisados</span></div>
      <div><strong>${research}</strong><span>research-only</span></div>
      <div><strong>${commercial}</strong><span>superficies comerciales gobernadas</span></div>`;
  };

  const manifest = window.JADEL_AGENT_READINESS;
  if (!manifest || manifest.schema_version !== "1.0.0" || !Array.isArray(manifest.agents)) {
    grid.innerHTML = `
      <article class="service-card">
        <div class="service-topline"><span class="service-icon">!</span><span class="status-badge status-pilot">Fail-closed</span></div>
        <h2>Registro de readiness no disponible</h2>
        <p>No se mostrará ningún agente como production-ready hasta recuperar un snapshot válido.</p>
      </article>`;
    return;
  }

  renderSummary(manifest.agents);
  grid.innerHTML = manifest.agents.map(card).join("");
})();
