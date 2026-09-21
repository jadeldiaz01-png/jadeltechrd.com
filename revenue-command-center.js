const API_ORIGIN="https://intake.jadeltechrd.com";
const $=(id)=>document.getElementById(id);
let token="";

function esc(value){
  return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setStatus(text,kind=""){ $("command-status").textContent=text; $("command-status").dataset.kind=kind; }
function enabled(value){
  for(const node of document.querySelectorAll("#refresh,.ai-action,#run-multimodal,#record-settlement,#disconnect")) node.disabled=!value;
}
async function api(path,options={}){
  if(!token) throw new Error("NOT_AUTHENTICATED");
  const response=await fetch(API_ORIGIN+path,{
    ...options,cache:"no-store",credentials:"omit",redirect:"error",
    headers:{"content-type":"application/json","authorization":`Bearer ${token}`,...(options.headers||{})}
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.blocker||body.error||`HTTP_${response.status}`);
  return body;
}
function renderRecommendations(items=[]){
  $("deterministic-recommendations").innerHTML=items.length?items.map((item)=>`
    <article class="recommendation-item">
      <strong>${esc(item.priority)} · ${esc(item.id)}</strong>
      <span>${esc(item.action)}</span>
      <small>${esc(item.scope)} · human=${esc(item.requires_human)}</small>
    </article>`).join(""):"<p>Sin recomendaciones deterministas.</p>";
}
function renderSettlements(items=[]){
  $("settlement-list").innerHTML=items.length?items.map((item)=>`
    <article class="recommendation-item">
      <strong>SETTLED_CASH · ${esc(item.settled_amount_usd)} ${esc(item.currency_code)}</strong>
      <span>Ledger ${esc(item.ledger_id)}</span>
      <small>${esc(item.settled_at)} · evidence ${esc(item.evidence_sha256)}</small>
    </article>`).join(""):"<p>Sin settlements registrados.</p>";
}
function renderRuns(items=[]){
  $("model-runs").innerHTML=items.length?items.map((run)=>`
    <article class="recommendation-item">
      <strong>${esc(run.status)} · ${esc(run.run_kind)}</strong>
      <span>${esc(run.model_id)}</span>
      <small>SHA ${esc(run.source_sha)} · ${esc(run.created_at)} · tokens ${esc(run.input_tokens)}/${esc(run.output_tokens)} · ${esc(run.latency_ms)} ms</small>
    </article>`).join(""):"<p>Sin ejecuciones registradas.</p>";
}
async function refresh(){
  const [view,runs,settlements]=await Promise.all([
    api("/api/v1/admin/revenue-intelligence"),
    api("/api/v1/admin/model-runs").catch(()=>({runs:[]})),
    api("/api/v1/admin/settlements").catch(()=>({settlements:[]}))
  ]);
  const s=view.summary||{};
  $("metric-revenue").textContent=Number(s.settled_cash_usd||0).toLocaleString("en-US",{style:"currency",currency:"USD"});
  $("metric-requests").textContent=String(s.total_requests??0);
  $("metric-qualified").textContent=String(s.qualified_leads??0);
  $("metric-converted").textContent=String(s.converted_customers??0);
  renderRecommendations(view.recommendation?.proposals||[]);
  $("runtime-state").textContent=JSON.stringify({
    revenue_recognition:s.revenue_recognition,
    evidence_state:view.evidence_state,
    ai_runtime:view.ai_runtime,
    knowledge_runtime:view.knowledge_runtime,
    authority:view.authority,
    production_authorized:view.production_authorized
  },null,2);
  renderRuns(runs.runs||[]);
  renderSettlements(settlements.settlements||[]);
}
$("revenue-auth")?.addEventListener("submit",async(event)=>{
  event.preventDefault();
  token=$("revenue-admin-token").value.trim();
  $("revenue-admin-token").value="";
  if(!token) return;
  setStatus("Verificando acceso…","working");
  try{ await refresh(); enabled(true); setStatus("Consola conectada. Token conservado sólo en memoria de esta pestaña.","success"); }
  catch{ token=""; enabled(false); setStatus("Acceso rechazado o runtime no disponible.","error"); }
});
$("disconnect")?.addEventListener("click",()=>{ token=""; enabled(false); setStatus("Desconectado."); $("ai-output").textContent="Sin ejecución."; });
$("refresh")?.addEventListener("click",async()=>{ try{setStatus("Actualizando…","working");await refresh();setStatus("Actualizado.","success");}catch(e){setStatus(`Error: ${e.message}`,"error");} });
document.addEventListener("click",async(event)=>{
  const button=event.target.closest(".ai-action[data-objective]");
  if(!button) return;
  document.querySelectorAll(".ai-action").forEach((x)=>x.disabled=true);
  $("ai-output").textContent="Ejecutando análisis shadow…";
  try{
    const body=await api("/api/v1/admin/revenue-intelligence/analyze",{method:"POST",body:JSON.stringify({objective:button.dataset.objective})});
    $("ai-output").textContent=JSON.stringify(body,null,2);
    await refresh();
  }catch(e){ $("ai-output").textContent=`NO_GO: ${e.message}`; }
  finally{ if(token) document.querySelectorAll(".ai-action").forEach((x)=>x.disabled=false); }
});
$("multimodal-form")?.addEventListener("submit",async(event)=>{
  event.preventDefault();
  $("run-multimodal").disabled=true;
  $("multimodal-output").textContent="Analizando asset privado…";
  try{
    const body=await api("/api/v1/admin/multimodal-qc",{method:"POST",body:JSON.stringify({
      asset_key:$("asset-key").value.trim(),rights_metadata_present:$("rights-metadata").checked
    })});
    $("multimodal-output").textContent=JSON.stringify(body,null,2);
    await refresh();
  }catch(e){ $("multimodal-output").textContent=`NO_GO: ${e.message}`; }
  finally{ if(token) $("run-multimodal").disabled=false; }
});

$("settlement-form")?.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(!$("settlement-confirm").checked) return;
  $("record-settlement").disabled=true;
  $("settlement-status").textContent="Registrando evidencia de settlement…";
  const localValue=$("settlement-at").value;
  const settledAt=localValue?new Date(localValue).toISOString():"";
  try{
    const body=await api("/api/v1/admin/settlements",{method:"POST",body:JSON.stringify({
      confirmation:"RECORD_SETTLED_CASH",
      ledger_id:$("settlement-ledger-id").value.trim(),
      settled_amount_usd:Number($("settlement-amount").value),
      settlement_reference:$("settlement-reference").value.trim(),
      evidence_sha256:$("settlement-evidence-sha").value.trim().toLowerCase(),
      settled_at:settledAt
    })});
    $("settlement-reference").value="";
    $("settlement-evidence-sha").value="";
    $("settlement-confirm").checked=false;
    $("settlement-status").textContent=`Registrado: ${body.state} · ${body.settled_amount_usd} ${body.currency_code}`;
    await refresh();
  }catch(e){
    $("settlement-status").textContent=`NO_GO: ${e.message}`;
  }finally{
    if(token) $("record-settlement").disabled=false;
  }
});
