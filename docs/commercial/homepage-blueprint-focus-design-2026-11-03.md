# Diseño: portada enfocada en AI Automation Blueprint

**Estado:** dirección seleccionada bajo delegación explícita del usuario; implementación local verificada en `codex/post-launch-acquisition-review-2026-11-03`; preview visual pendiente; no publicado.

**Decisión de enfoque:** opción 2, elegida por Codex bajo la delegación previa del usuario para decidir la dirección.

## Intención

Convertir la portada en una ruta clara hacia la primera venta global del AI Automation Blueprint, manteniendo el resto del catálogo disponible como navegación secundaria.

## Evidencia y problema

- La portada pública anuncia 11+ servicios y usa un titular amplio sobre web, automatización e IA; el CTA del Blueprint aparece en el hero, pero la explicación del alcance y la muestra quedan más abajo.
- La inspección de enlaces públicos encontró 5/5 rutas críticas HTTP 200: [portada](https://jadeltechrd.com/), [detalle ES](https://jadeltechrd.com/ai-automation-blueprint.html), [landing EN](https://jadeltechrd.com/en/), [intake ES](https://jadeltechrd.com/solicitar-proyecto.html), [intake EN](https://jadeltechrd.com/en/request-project.html). En español, el CTA del hero llega al formulario tras dos clics (portada → detalle → intake); en inglés, la landing llega al intake con un clic. La portada también tiene una CTA directa al intake en la tarjeta Blueprint, más abajo.
- El HTML público de portada contiene 10 secciones, 11 tarjetas de servicio, 12 enlaces con etiqueta “Solicitar cotización” y 3 CTA del Blueprint; 2 de estas 3 CTA llegan directamente al intake. El conteo prueba la dispersión de rutas en el markup, no su visibilidad ni uso.
- De 14 CTA/enlaces de solicitud revisados, 12 tenían evento e ID único. La CTA Blueprint de precios carecía de evento/ID; el cambio local la instrumenta y añade una CTA de alcance instrumentada. GA4 requiere consentimiento, por lo que no cubre a visitantes que lo rechazan.
- La oferta verificable es un Blueprint de un solo flujo, desde US$250 y máximo 2.5 horas, con cotización revisada por una persona antes del pago.
- El sitio informa que todavía no se ha conciliado una captura PayPal real. No se debe presentar checkout global como validado.
- GA4 reporta para octubre 48 sesiones, cinco clics de CTA y cuatro eventos `generate_lead`, pero no ofrece los IDs de CTA; dos leads vienen de `sandbox.paypal.com / referral`. Faltan solicitudes únicas conciliadas, sesiones elegibles limpias y pagos conciliados; no se puede comparar mensaje ni inferir conversión.
- Como señal de segmento (no TAM ni demanda pagada), [Eurostat](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Use_of_artificial_intelligence_in_enterprises) reporta uso de IA en 62.52% de empresas UE de información/comunicación y 40.43% de servicios profesionales/tecnológicos; el promedio es 19.95%. En una encuesta [OECD](https://www.oecd.org/en/publications/generative-ai-and-the-sme-workforce_2d08b99d-en/full-report/component-4.html) de pymes de siete países, marketing/ventas es el uso de IA generativa más común, pero solo 28.7% de las pymes usuarias la aplica en actividades principales. Esto favorece probar diagnóstico de un proceso comercial en firmas de conocimiento, sin asumir conversión o disposición a pagar.

## Público y acción principal

Dueños u operadores de agencias digitales, consultoras y firmas profesionales o tecnológicas pequeñas que reciben consultas por web, WhatsApp o email y aún clasifican o siguen leads manualmente. Priorizar visitas en español (España/Latinoamérica) e inglés donde el servicio pueda entregarse con solvencia; validar ambos por separado. Acción principal: solicitar una cotización del Blueprint para mapear un único flujo de captación y seguimiento de leads.

## Enfoques considerados

1. **Cambiar solo el texto del hero.** Bajo coste y exposición, pero conserva la competencia visual del catálogo y otras rutas antes de explicar la oferta.
2. **Reordenar la portada para vender primero el Blueprint.** Presentar problema, resultado acotado, entregables, muestra y pasos de compra antes del catálogo; mantiene todas las capacidades disponibles abajo. **Seleccionado:** alinea la página con la hipótesis de primera venta y concentra la instrumentación en una ruta ya existente.
3. **Crear páginas por industria.** Permite mensajes específicos para segmentos, pero añade páginas y fragmenta tráfico antes de conocer qué segmento responde.

## Diseño propuesto

1. Hero bilingüe centrado en el problema concreto: un proceso de seguimiento de leads lento o inconsistente. Hacer visible desde el primer bloque que es un proceso, desde US$250 y hasta 2.5 h; explicar que se diseña el plan antes de construirlo.
2. Un CTA primario directo al intake localizado con `offer_id=automation_blueprint` y UTM; secundario discreto para ver otros servicios. Así se quita un clic del recorrido del hero español. El hero debe incluir la información mínima de decisión antes del CTA.
3. Alcance visible de inmediato: un proceso, reunión de hasta 45 minutos, mapa breve, arquitectura recomendada, backlog priorizado, una ronda de aclaraciones y tope de 2.5 h.
4. Mostrar el PDF ilustrativo como muestra de formato, rotulado como hipotético y no como caso de cliente.
5. Explicar el flujo real: solicitud → revisión/cotización humana → checkout PayPal asociado a la cotización → entrega después de conciliación. Mantener US$250 como precio de prueba.
6. Bajar el catálogo y sus rutas alternativas por debajo de la sección Blueprint. No eliminar servicios.
7. Mantener el consentimiento analítico y los eventos permitidos; no enviar PII a GA4. Etiquetar también la CTA de precios con un `cta_id` único en el allowlist (`homepage_blueprint_pricing`) para comparar su ubicación con el hero y la tarjeta.

## Medición y criterios

Registrar por idioma, canal y ubicación de CTA: sesiones elegibles, `offer_view`, `offer_cta_click`, inicio de intake, solicitud completa, calificación, cotización, cobro conciliado, horas y fees. Analítica de navegador solo cuenta eventos posteriores al consentimiento; cotejar con los registros de solicitudes/pagos y no inferir eventos de visitantes que no acepten. Comparar con cohortes previas solo si tienen denominadores y atribución comparables. Reunir al menos 100 sesiones elegibles por canal como lectura inicial para validar atribución y eventos, no como prueba de venta: el escenario base hipotético da 21.4% de probabilidad de ≥1 venta en 100 sesiones y 95% requeriría ~1,247 sesiones si la tasa base fuese real. No declarar una tasa de conversión validada ni un ganador con la muestra inicial.

Éxito comercial inicial: una venta pagada y conciliada, entregada en ≤2.5 h y con margen bruto ≥60% después de fees y costes directos medidos. Este objetivo no sustituye la meta de ventas repetibles.

## Límites

- No prometer ventas, ROI, ahorros ni mejoras antes de medirlos.
- No inventar testimonios, casos o métricas de clientes.
- No cambiar precio, métodos de pago, checkout, formularios, idioma, permisos OAuth ni comportamiento de producción dentro de este diseño.
- Cualquier publicación queda sujeta a revisión y autorización conforme a los gates del repositorio.

## Estado de aprobación y ejecución

El usuario autorizó delegar la decisión de enfoque. La dirección Blueprint-first queda seleccionada. Se implementó el enfoque en `index.html` y también en la plantilla que `app.js` inyecta sobre el HTML estático; ambas versiones conservan alcance, precio, CTA e instrumentación consistentes. La publicación sigue sujeta al gate de producción del repositorio.
