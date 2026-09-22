# Revenue Funnel v1 — Jadel Tech RD

**Estado:** IMPLEMENTATION_CANDIDATE  
**Baseline:** `26564e74095e3eac61396480d70ee4c7d356743c`  
**Fecha:** 2026-09-20

## Decisión

Revenue Funnel v1 reduce el frente comercial a tres ofertas visibles y medibles, sin eliminar el catálogo técnico existente:

1. **Agente IA para WhatsApp, Soporte y Tickets** — US$900 + US$149/mes.
2. **Automatización de Procesos y Agentic Blueprint** — desde US$250.
3. **Sales & Lead Intelligence** — desde US$1,500 + US$299/mes.

La selección usa precios ya publicados por Jadel Tech RD y prioriza problemas con intención comercial observable en el mercado dominicano: atención por WhatsApp, automatización de procesos y seguimiento de leads. No se importan claims de ROI de terceros.

## Funnel

`landing_session -> offer_cta_click -> intake_start -> generate_lead -> working_lead -> qualify_lead|disqualify_lead -> close_convert_lead|close_unconvert_lead`

### Eventos públicos

El navegador solo puede emitir eventos sin PII:
- `offer_view`
- `offer_cta_click`
- `intake_start`
- `generate_lead` después de que el intake confirme éxito.

### Eventos de backend/CRM

Nunca se confía en JavaScript del navegador para afirmar resultados comerciales:
- `working_lead`
- `qualify_lead`
- `disqualify_lead`
- `close_convert_lead`
- `close_unconvert_lead`

Google Analytics recomienda los eventos de generación de leads anteriores para poblar su Lead Acquisition report. Para Google Ads, el feedback offline debe diseñarse con Data Manager API según el cambio efectivo de junio de 2026.

## GA4 y join de outcomes

GA4 está activo con el Measurement ID `G-K60SQ2ZHL9`. Existe evidencia real de actividad en producción y se conserva como agregado en `evidence/analytics/ga4-observed-2026-09-20.json`.

Para enlazar un `generate_lead` con su outcome comercial sin enviar PII, cada envío exitoso usa un UUIDv4 de un solo uso llamado `lead_event_id`. El runtime lo guarda como `project_requests.analytics_join_id` y el navegador lo emite únicamente con `generate_lead`. No se registra como dimensión personalizada de GA4 y no funciona como identidad persistente de usuario o dispositivo.

El siguiente gate es observar el dataset diario `analytics_555066228.events_YYYYMMDD`, congelar solamente fechas estables y unirlas con los outcomes terminales gobernados de D1. Nombre, email, teléfono, empresa, notas, secretos e identificadores de pago quedan fuera del dataset de ML.

## Dashboard

Ventanas: 7, 30 y 90 días.

Tarjetas obligatorias:
- eligible landing sessions
- generate_lead
- qualify_lead
- close_convert_lead
- landing-to-lead rate
- qualification rate
- qualified-to-customer rate
- CPL
- CPQL
- CAC
- new MRR
- gross-margin payback months

Breakdowns obligatorios: offer, landing, source, medium y campaign.

## Acquisition gates

### G0 — Measurement integrity
Bloquea adquisición pagada hasta que GA4 y feedback offline estén verificados.

### G1 — Organic/outreach
Permitido de forma supervisada. Sitemap, Search Console y UTM taxonomy son obligatorios.

### G2 — Paid pilot
Requiere presupuesto y CAC ceiling aprobados por humano. Gasto autónomo = USD 0.

### G3 — Scale
Solo con economía positiva después de costes variables, CAC dentro del techo aprobado y sin incidentes de calidad de datos. Para optimizar Google Ads hacia una acción downstream, se exige además el criterio documentado por Google de al menos 15 conversiones de esa acción en los últimos 30 días.

## SEO

Cada landing responde a una intención primaria; no hay keyword stuffing. Las páginas usan canonical, descripción específica y enlazan al intake con `utm_campaign=revenue_funnel_v1`.

## No-governance regression

Revenue Funnel v1 no cambia:
- autorización de producción institucional;
- SLO/error-budget del dominio público;
- agents/connectors/social;
- trading o capital financiero;
- publicación autónoma;
- permisos de pago.

## Fuentes de decisión

- Google Analytics — Recommended lead generation events: https://support.google.com/analytics/answer/9267735
- Google Ads — Best practices for high-quality leads: https://support.google.com/google-ads/answer/13489421
- Google Ads — 2026 enhanced/offline conversion migration: https://support.google.com/google-ads/answer/16884284
