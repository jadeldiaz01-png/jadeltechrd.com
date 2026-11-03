# Plan de implementación: portada Blueprint bilingüe

> **Para agentes de implementación:** ejecutar tarea por tarea y verificar cada resultado antes de continuar.

**Objetivo:** Convertir las portadas ES/EN en una ruta concisa y medible hacia la solicitud del AI Automation Blueprint, preservando el catálogo secundario.

**Arquitectura:** Mantener la oferta y el intake actuales, reorganizar los bloques de portada y conectar cada CTA de Blueprint a su intake localizado con UTMs/identificadores únicos. No se alteran backend, formulario, cotización manual, pago, consentimiento ni APIs.

**Tecnología:** HTML estático, CSS y JavaScript de analítica existente; validadores Node.js existentes.

**Diseño:** `docs/commercial/homepage-blueprint-focus-design-2026-11-03.md`

## Restricciones

- Oferta: un flujo de captación y seguimiento de leads; desde US$250; máximo 2.5 h; reunión hasta 45 min; una ronda de aclaraciones.
- Muestra ilustrativa, no caso de cliente.
- Compra real: solicitud → revisión/cotización humana → checkout PayPal vinculado a cotización → entrega tras conciliación.
- Mantener consentimiento analítico; no enviar PII a GA4.
- Mantener el catálogo y ubicarlo debajo de la oferta.
- No afirmar resultados, clientes, ROI ni pagos conciliados sin evidencia.
- No cambiar backend, formulario, OAuth ni producción en este cambio.

## Revisión de riesgos

- Localización: cada CTA principal va al intake del idioma correspondiente.
- Atribución: IDs únicos; evitar eventos duplicados por listeners/navegación.
- No usar UTMs estáticas de la propia página como si fueran fuente de adquisición.
- Consentimiento: ausencia de evento no equivale a ausencia de visita.
- `generate_lead` no equivale a una persona única; conciliar con registros canónicos.
- `purchase` no sustituye settlement conciliado de PayPal.

---

### Tarea 1: Reenfocar portada ES

**Archivos:** modificar `index.html`; usar `solicitar-proyecto.html`.

- [x] Presentar primero problema, resultado, alcance, desde US$250 y máximo 2.5 h.
- [x] Alinear title, description y metadatos Open Graph/Twitter con la oferta inicial ES.
- [x] CTA primaria directa al intake ES con `offer_id=automation_blueprint`, mantener ID histórico `homepage_blueprint_entry` y UTMs.
- [x] Añadir muestra ilustrativa y flujo real de compra antes del catálogo; catálogo sigue disponible debajo.
- [x] Sincronizar la plantilla dinámica de `app.js`; la inicialización reemplaza el HTML estático y sin esta tarea habría conservado el hero anterior.
- [x] Añadir CTA de alcance y CTA de precios con IDs distintos.
- [x] Revisión estática y pruebas: ES, alcance/precio, enlace directo, IDs, copy sin promesas y catálogo preservado en ambos renderizados.

### Tarea 2: Verificar portada EN ya enfocada

**Archivos:** inspeccionar `en/index.html`; usar `en/request-project.html`.

- [x] Confirmado: ya expone oferta de un flujo desde US$250, límite de 2.5 horas, muestra ilustrativa y cotización humana.
- [x] Confirmado: CTA primaria al intake EN con `english_blueprint_entry` y UTMs.
- [x] Decisión: no duplicar la landing EN, que ya satisface el enfoque y funciona como ruta de conversión.
- Ruling: no se modificó `en/index.html` porque el código actual ya entrega la oferta Blueprint-first y CTA al intake; duplicar el cambio aumenta el riesgo de diferencias sin reducir fricción.

### Tarea 3: Completar evento de CTA de precio

**Archivos:** `index.html`, `ga4-loader.js`, `revenue-funnel.js`.

- [x] Etiquetar CTA de precio `homepage_blueprint_pricing` y CTA de alcance `homepage_blueprint_scope`.
- [x] Permitir ambos IDs en las regex allowlist sin ampliar parámetros ni admitir PII.
- [x] Revisión estática: listener global existente, IDs únicos en portada ES y dos regex allowlist exactas; no se abrió el allowlist de parámetros.
- [x] Hallazgo nuevo: los UTMs estáticos `website/homepage`, `pricing` y `service_catalog` se guardaban como canal de los requests, ocultando la fuente de adquisición real.
- [x] Eliminar los UTM internos de los enlaces de navegación/cotización; el backend sigue limpiando valores fuera de allowlist como defensa adicional.
- [x] Emitir `generate_lead` únicamente para una solicitud aceptada no repetida, con `lead_source=project_request`; permitir el valor en ambos sanitizadores analíticos.
- [x] Cambiar los clics same-origin instrumentados para conservar source/medium/campaign de la sesión, quitar esos valores internos y escribir `cta_id` en `utm_content` del intake. Se usa el campo existente del D1, sin migración ni PII.
- Ruling: `utm_content` se reutiliza para posición de CTA en la solicitud en vez de añadir una columna D1; conserva source/medium/campaign y evita migración. Coste: la solicitud no conserva el UTM content de creatividad original; si se prueban creatividades pagadas, crear columna `cta_id` separada antes de escalar.
- [ ] Comprobar en preview que formulario y Worker reciben el `utm_content` de posición y las UTMs de origen, tanto con una URL etiquetada como sin ella.

### Tarea 4: Verificar preview antes de publicación

**Archivos:** ninguno adicional.

- [x] Servidor estático local: HTTP 200 para `/`, `/en/`, ambos intakes, `/ai-automation-blueprint.html` y el PDF ilustrativo (6/6).
- [ ] Revisión móvil/escritorio: orden, CTA, contraste y foco de teclado.
- [ ] Revisar diff contra diseño/baseline; no fusionar ni publicar sin gate de release.
- [ ] Antes de depender de cortes por posición, verificar en GA4 que exista la dimensión personalizada de evento `cta_id`; si no existe, un usuario Editor/Administrador debe crearla y esperar 24–48 h. No se hizo cambio de propiedad.
- [ ] Tras publicación autorizada y dimensión disponible, medir CTA por ID/idioma, `intake_start` y `generate_lead`; conciliar leads y pagos por separado.

**Validación local:** `node --test tests/*.test.mjs` pasó con 80/80, incluidos casos de solicitud nueva y replay idempotente; las pruebas runtime focalizadas de atribución pasaron con 8/8; `node scripts/validate-revenue-funnel-v1.mjs` reportó `REVENUE_FUNNEL_V1=PASS`; `node --check` pasó para `app.js`, `project-request.js`, `revenue-funnel.js` y `ga4-loader.js`. `git diff --check` solo reporta avisos LF/CRLF. No se envió una solicitud al Worker real. Preview visual/respuestas HTTP del código modificado quedan pendientes.

**Bloqueo de preview:** la skill Playwright exige `npx`; la consulta local `Get-Command npx` no encontró ejecutable. Su instrucción indica pausar la automatización y pedir que se instale Node.js/npm antes de continuar con preview visual.

**Bloqueo de reporte de clics por CTA:** `get_fields` de GA4 no devolvió dimensión `cta_id`; Google exige registrar una dimensión personalizada para reportar ese parámetro ([documentación oficial](https://support.google.com/analytics/answer/14239696?hl=en)). Para atribución de solicitudes individuales, el cambio usa el `utm_content` ya persistido por D1, sin depender de esa dimensión. La cuenta del conector aún debe resolverse para volver a consultar GA4.

## Fuera de alcance

Checkout nuevo, cambios de precio, consentimiento, conexión GSC y exclusión automática de tráfico de PayPal sandbox. Requieren evidencia o autorización/cambio de alcance.

### Revalidación de preview local — 3-nov-2026

Un servidor estático local respondió HTTP 200 en 6 de 6 rutas: portada ES/EN, intake ES/EN, detalle del Blueprint y PDF bilingüe. El servidor temporal se detuvo tras la comprobación. La inspección visual de móvil/escritorio queda pendiente: la conexión browser-client devolvió `not trusted` y la configuración de trabajo reportó que el uso de navegador local está desactivado. No se envió el formulario ni se probó la API/Worker desde el servidor estático.
