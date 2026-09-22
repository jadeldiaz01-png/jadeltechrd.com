const API_ORIGIN = "https://intake.jadeltechrd.com";
const APPROVALS_URL = `${API_ORIGIN}/api/v1/admin/approvals`;
const LEAD_LIFECYCLE_URL = `${API_ORIGIN}/api/v1/admin/lead-lifecycle`;

const form = document.getElementById("approval-auth");
const tokenInput = document.getElementById("admin-token");
const statusNode = document.getElementById("approval-status");
const resultsNode = document.getElementById("approval-results");

let token = "";

function setStatus(message, kind = "") {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
}

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP_${response.status}`);
  return body;
}

function leadActions(project) {
  const latest = project.latest_stage || "";
  const transitions = {
    "": [["working_lead","Iniciar trabajo"]],
    "working_lead": [["qualify_lead","Calificar"],["disqualify_lead","No califica"]],
    "qualify_lead": [["close_convert_lead","Cerrar convertido"],["close_unconvert_lead","Cerrar no convertido"]],
  };
  const choices = transitions[latest] || [];
  if (!choices.length) return "<small>Outcome terminal registrado.</small>";
  return choices.map(([stage,label]) =>
    `<button data-lead-stage="${stage}" data-project="${htmlEscape(project.project_id)}">${label}</button>`
  ).join("");
}

function render(approvals, lifecycle) {
  const projects = approvals.projects || [];
  const payments = approvals.payments || [];
  const lifecycleProjects = lifecycle.projects || [];
  const summary = lifecycle.summary || {};

  resultsNode.innerHTML = `
    <div class="approval-list">
      <section>
        <h3>Solicitudes pendientes de política</h3>
        ${projects.length ? projects.map((project) => `
          <article>
            <strong>${htmlEscape(project.name)} · ${htmlEscape(project.email)}</strong>
            <span>${htmlEscape(project.state)} / ${htmlEscape(project.policy_status)}</span>
            <small>${htmlEscape(project.service_ids_json)}</small>
            <div>
              <button data-decision="APPROVED" data-project="${htmlEscape(project.project_id)}">Aprobar política</button>
              <button data-decision="NEEDS_INFO" data-project="${htmlEscape(project.project_id)}">Pedir datos</button>
              <button data-decision="DENIED" data-project="${htmlEscape(project.project_id)}">Denegar</button>
            </div>
          </article>`).join("") : "<p>No hay solicitudes pendientes.</p>"}
      </section>
      <section>
        <h3>Outcomes comerciales etiquetados</h3>
        <p>
          Positivos terminales: <strong>${Number(summary.positive_terminal_labels || 0)}</strong> ·
          Negativos terminales: <strong>${Number(summary.negative_terminal_labels || 0)}</strong>
        </p>
        ${lifecycleProjects.length ? lifecycleProjects.map((project) => `
          <article>
            <strong>${htmlEscape(project.name)} · ${htmlEscape(project.email)}</strong>
            <span>Lifecycle: ${htmlEscape(project.latest_stage || "sin etiqueta")}</span>
            <small>${htmlEscape(project.service_ids_json)} · ${htmlEscape(project.created_at)}</small>
            <div>${leadActions(project)}</div>
          </article>`).join("") : "<p>No hay solicitudes para etiquetar.</p>"}
      </section>
      <section>
        <h3>Pagos por reconciliar</h3>
        ${payments.length ? payments.map((payment) => `
          <article>
            <strong>${htmlEscape(payment.provider_event_id)}</strong>
            <span>${htmlEscape(payment.ledger_state)} · ${htmlEscape(payment.amount_usd)} ${htmlEscape(payment.currency_code)}</span>
            <small>${htmlEscape(payment.created_at)}</small>
          </article>`).join("") : "<p>No hay pagos pendientes.</p>"}
      </section>
    </div>`;
}

async function loadAll() {
  const [approvals, lifecycle] = await Promise.all([
    api(APPROVALS_URL),
    api(LEAD_LIFECYCLE_URL),
  ]);
  render(approvals, lifecycle);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  token = tokenInput.value.trim();
  if (!token) return;
  setStatus("Cargando operación gobernada...", "working");
  try {
    await loadAll();
    setStatus("Datos operativos cargados.", "success");
    tokenInput.value = "";
  } catch {
    setStatus("No se pudo cargar la consola. Verifica token y runtime.", "error");
  }
});

resultsNode?.addEventListener("click", async (event) => {
  const policyButton = event.target.closest("button[data-decision]");
  const lifecycleButton = event.target.closest("button[data-lead-stage]");
  if (!policyButton && !lifecycleButton) return;

  try {
    if (policyButton) {
      setStatus("Registrando decisión de política...", "working");
      await api(APPROVALS_URL, {
        method: "POST",
        body: JSON.stringify({
          project_id: policyButton.dataset.project,
          approval_type: "policy",
          decision: policyButton.dataset.decision,
          reason: "operator console decision",
        }),
      });
    } else {
      setStatus("Registrando outcome comercial...", "working");
      await api(LEAD_LIFECYCLE_URL, {
        method: "POST",
        body: JSON.stringify({
          project_id: lifecycleButton.dataset.project,
          stage: lifecycleButton.dataset.leadStage,
          source_event_id: crypto.randomUUID(),
          reason_code: "OPERATOR_CONSOLE",
        }),
      });
    }
    await loadAll();
    setStatus("Evidencia registrada.", "success");
  } catch (error) {
    const code = String(error?.message || "ACTION_FAILED");
    setStatus(`No se pudo registrar la decisión (${code}).`, "error");
  }
});
