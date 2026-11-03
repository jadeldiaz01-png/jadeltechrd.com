(() => {
  "use strict";

  const ids = ["classify-demo", "draft-demo", "approve-demo", "reset-demo", "classification-result", "draft-result", "approval-result", "demo-status"];
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  if (Object.values(elements).some((element) => !element)) return;

  const english = document.documentElement.lang === "en";
  const copy = english
    ? { classified: "Simulated classification ready.", drafted: "Draft prepared for review.", approved: "Approved in this simulation; no message was sent.", reset: "Demo reset. No messages have been sent.", initial: "Ready to simulate the sample workflow." }
    : { classified: "Clasificación simulada lista.", drafted: "Borrador preparado para revisión.", approved: "Aprobado en esta simulación; no se envió ningún mensaje.", reset: "Demo reiniciada. No se enviaron mensajes.", initial: "Lista para simular el flujo de ejemplo." };

  elements["classify-demo"].addEventListener("click", () => {
    elements["classification-result"].hidden = false;
    elements["classify-demo"].disabled = true;
    elements["draft-demo"].disabled = false;
    elements["demo-status"].textContent = copy.classified;
  });

  elements["draft-demo"].addEventListener("click", () => {
    elements["draft-result"].hidden = false;
    elements["draft-demo"].disabled = true;
    elements["approve-demo"].disabled = false;
    elements["demo-status"].textContent = copy.drafted;
  });

  elements["approve-demo"].addEventListener("click", () => {
    elements["approval-result"].hidden = false;
    elements["approve-demo"].disabled = true;
    elements["demo-status"].textContent = copy.approved;
  });

  elements["reset-demo"].addEventListener("click", () => {
    for (const id of ["classification-result", "draft-result", "approval-result"]) elements[id].hidden = true;
    elements["classify-demo"].disabled = false;
    elements["draft-demo"].disabled = true;
    elements["approve-demo"].disabled = true;
    elements["demo-status"].textContent = copy.reset;
  });

  elements["demo-status"].textContent = copy.initial;
})();
